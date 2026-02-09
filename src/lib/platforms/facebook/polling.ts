import { db } from '@/lib/db';
import { shows, comments as commentsTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getLiveComments, RateLimitError, type FBComment } from './api';
import { processComment } from '@/lib/claim-engine/allocator';
import { broadcastToShow } from '@/lib/realtime/server';
import { decrypt } from '@/lib/encryption';
import type { CommentInfo } from '@/lib/claim-engine/types';

type PollingState = {
  timer: NodeJS.Timeout | null;
  afterCursor: string | null;
  running: boolean;
  backoffMs: number;
  seenCommentIds: Set<string>;
};

const activePollers = new Map<string, PollingState>();

const DEFAULT_INTERVAL_MS = 2000;
const MAX_BACKOFF_MS = 30000;
const BASE_BACKOFF_MS = 2000;

/**
 * Start polling comments for a live video.
 */
export function startPolling(
  showId: string,
  liveVideoId: string,
  encryptedAccessToken: string,
  intervalMs = DEFAULT_INTERVAL_MS,
) {
  if (activePollers.has(showId)) {
    stopPolling(showId);
  }

  const state: PollingState = {
    timer: null,
    afterCursor: null,
    running: true,
    backoffMs: 0,
    seenCommentIds: new Set(),
  };

  activePollers.set(showId, state);

  async function poll() {
    if (!state.running) return;

    try {
      const accessToken = decrypt(encryptedAccessToken);
      const page = await getLiveComments(accessToken, liveVideoId, state.afterCursor ?? undefined);

      // Reset backoff on success
      state.backoffMs = 0;

      // Update cursor for next page
      if (page.afterCursor) {
        state.afterCursor = page.afterCursor;
      }

      // Get show data for claim/pass words
      const [show] = await db
        .select({ claimWord: shows.claimWord, passWord: shows.passWord, status: shows.status })
        .from(shows)
        .where(eq(shows.id, showId))
        .limit(1);

      if (!show || show.status !== 'active') {
        stopPolling(showId);
        return;
      }

      // Process new comments (skip already seen)
      for (const fbComment of page.comments) {
        if (state.seenCommentIds.has(fbComment.id)) continue;
        state.seenCommentIds.add(fbComment.id);

        const commentInfo = fbCommentToCommentInfo(fbComment, liveVideoId);

        const result = await processComment(
          db,
          showId,
          commentInfo,
          show.claimWord,
          show.passWord,
        );

        // Broadcast comment
        broadcastToShow(showId, {
          type: 'comment.received',
          data: {
            showId,
            commentId: fbComment.id,
            userHandle: commentInfo.userHandle,
            text: commentInfo.rawText,
            parsed: result.parsed,
            timestamp: commentInfo.timestamp.toISOString(),
          },
        });

        // Broadcast claim if created
        if (result.result && 'claimId' in result.result) {
          const r = result.result;
          if (r.status === 'winner' || r.status === 'waitlist') {
            broadcastToShow(showId, {
              type: 'claim.created',
              data: {
                claimId: r.claimId,
                showId,
                itemNumber: r.itemNumber,
                userHandle: commentInfo.userHandle,
                claimStatus: r.status,
                waitlistPosition: r.status === 'waitlist' ? r.position : undefined,
                timestamp: commentInfo.timestamp.toISOString(),
              },
            });
          }
        }
      }

      // Prune seen IDs to prevent memory growth (keep last 10k)
      if (state.seenCommentIds.size > 10000) {
        const arr = Array.from(state.seenCommentIds);
        state.seenCommentIds = new Set(arr.slice(arr.length - 5000));
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        state.backoffMs = Math.min(
          state.backoffMs === 0 ? BASE_BACKOFF_MS : state.backoffMs * 2,
          MAX_BACKOFF_MS,
        );
        console.warn(`[Polling ${showId}] Rate limited, backing off ${state.backoffMs}ms`);
      } else {
        console.error(`[Polling ${showId}] Error:`, err);
        state.backoffMs = Math.min(
          state.backoffMs === 0 ? BASE_BACKOFF_MS : state.backoffMs * 2,
          MAX_BACKOFF_MS,
        );
      }
    }

    if (state.running) {
      const delay = intervalMs + state.backoffMs;
      state.timer = setTimeout(poll, delay);
    }
  }

  // Kick off first poll
  state.timer = setTimeout(poll, 0);
}

/**
 * Stop polling for a show.
 */
export function stopPolling(showId: string) {
  const state = activePollers.get(showId);
  if (state) {
    state.running = false;
    if (state.timer) clearTimeout(state.timer);
    activePollers.delete(showId);
  }
}

/**
 * Check if polling is active for a show.
 */
export function isPolling(showId: string): boolean {
  return activePollers.has(showId);
}

function fbCommentToCommentInfo(comment: FBComment, liveVideoId: string): CommentInfo {
  return {
    platform: 'facebook',
    liveId: liveVideoId,
    commentId: comment.id,
    platformUserId: comment.from.id,
    userHandle: comment.from.name,
    userDisplayName: comment.from.name,
    rawText: comment.message,
    timestamp: new Date(comment.created_time),
  };
}
