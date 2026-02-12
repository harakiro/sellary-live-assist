import { db } from '@/lib/db';
import { shows, workspaces, comments as commentsTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getLiveComments, RateLimitError, type FBComment } from './api';
import { processComment } from '@/lib/claim-engine/allocator';
import { broadcastToShow } from '@/lib/realtime/server';
import { decrypt } from '@/lib/encryption';
import { sendAutoReply, type ReplyCase } from './reply';
import type { CommentInfo } from '@/lib/claim-engine/types';

type WorkspaceAutoReplySettings = {
  autoReplyEnabled?: boolean;
  replyTemplatesWinner?: string[];
  replyTemplatesDuplicate?: string[];
  replyTemplatesWaitlist?: string[];
};

type PollingState = {
  timer: NodeJS.Timeout | null;
  afterCursor: string | null;
  running: boolean;
  backoffMs: number;
  seenCommentIds: Set<string>;
  // Stored so we can restart after HMR kills timers
  liveVideoId: string;
  encryptedAccessToken: string;
  intervalMs: number;
};

// Persist across Next.js HMR reloads in dev
const g = globalThis as unknown as {
  __activePollers?: Map<string, PollingState>;
};
if (!g.__activePollers) {
  g.__activePollers = new Map();
}
const activePollers = g.__activePollers;

const DEFAULT_INTERVAL_MS = 5000;
const MAX_BACKOFF_MS = 30000;
const BASE_BACKOFF_MS = 2000;

/**
 * The core polling loop — shared between startPolling and HMR recovery.
 */
function createPollLoop(showId: string, state: PollingState) {
  const { liveVideoId, encryptedAccessToken, intervalMs } = state;

  async function poll() {
    if (!state.running) return;

    try {
      const accessToken = decrypt(encryptedAccessToken);
      const page = await getLiveComments(accessToken, liveVideoId, state.afterCursor ?? undefined);

      state.backoffMs = 0;

      console.log(`[Polling ${showId}] Fetched ${page.comments.length} comments, cursor: ${state.afterCursor ?? 'none'} -> ${page.afterCursor ?? 'none'}`);

      if (page.afterCursor) {
        state.afterCursor = page.afterCursor;
      }

      const [show] = await db
        .select({
          claimWord: shows.claimWord,
          passWord: shows.passWord,
          status: shows.status,
          workspaceId: shows.workspaceId,
        })
        .from(shows)
        .where(eq(shows.id, showId))
        .limit(1);

      if (!show || show.status !== 'active') {
        stopPolling(showId);
        return;
      }

      // Fetch workspace settings for auto-reply (once per poll cycle)
      let autoReplySettings: WorkspaceAutoReplySettings = {};
      const [ws] = await db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, show.workspaceId))
        .limit(1);
      if (ws?.settings) {
        autoReplySettings = ws.settings as WorkspaceAutoReplySettings;
      }

      for (const fbComment of page.comments) {
        if (state.seenCommentIds.has(fbComment.id)) continue;
        state.seenCommentIds.add(fbComment.id);

        if (!fbComment.from) {
          console.log(`[Polling ${showId}] Comment ${fbComment.id} missing 'from' (dev mode limitation), using fallback`);
        }

        console.log(`[Polling ${showId}] Processing comment from ${fbComment.from?.name ?? 'unknown'}: "${fbComment.message}"`);

        const commentInfo = fbCommentToCommentInfo(fbComment, liveVideoId);

        const result = await processComment(
          db,
          showId,
          commentInfo,
          show.claimWord,
          show.passWord,
        );

        if (result.duplicate) continue;

        broadcastToShow(showId, {
          type: 'comment.received',
          data: {
            showId,
            commentId: fbComment.id,
            userHandle: commentInfo.userHandle,
            text: commentInfo.rawText,
            parsed: result.parsed,
            isReply: !!fbComment.parent,
            parentCommentId: fbComment.parent?.id,
            timestamp: commentInfo.timestamp.toISOString(),
          },
        });

        if (result.result && 'claimId' in result.result) {
          const r = result.result;
          if (r.status === 'winner' || r.status === 'waitlist' || r.status === 'unmatched') {
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
          } else if (r.status === 'released') {
            broadcastToShow(showId, {
              type: 'claim.released',
              data: {
                claimId: r.claimId,
                showId,
                itemNumber: r.itemNumber,
                userHandle: commentInfo.userHandle,
                promoted: r.promoted,
                timestamp: commentInfo.timestamp.toISOString(),
              },
            });

            if (r.item) {
              broadcastToShow(showId, {
                type: 'item.updated',
                data: {
                  itemId: r.item.id,
                  showId,
                  itemNumber: r.itemNumber,
                  claimedCount: r.item.claimedCount,
                  totalQuantity: r.item.totalQuantity,
                  status: r.item.status,
                },
              });
            }
          }
        }

        // Auto-reply to claim comments (only for ClaimResult which has itemNumber)
        if (autoReplySettings.autoReplyEnabled && result.result && 'itemNumber' in result.result) {
          const r = result.result;
          let replyCase: ReplyCase | null = null;
          let templates: string[] = [];

          if (r.status === 'winner') {
            replyCase = 'winner';
            templates = autoReplySettings.replyTemplatesWinner || [];
          } else if (r.status === 'duplicate_user') {
            replyCase = 'duplicate';
            templates = autoReplySettings.replyTemplatesDuplicate || [];
          } else if (r.status === 'waitlist') {
            replyCase = 'waitlist';
            templates = autoReplySettings.replyTemplatesWaitlist || [];
          }

          if (replyCase && templates.length > 0) {
            sendAutoReply({
              commentId: fbComment.id,
              userDisplayName: commentInfo.userDisplayName,
              itemNumber: r.itemNumber,
              encryptedAccessToken,
              replyCase,
              templates,
            });
          }
        }
      }

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

  state.timer = setTimeout(poll, 0);
}

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
    liveVideoId,
    encryptedAccessToken,
    intervalMs,
  };

  activePollers.set(showId, state);
  createPollLoop(showId, state);
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
    platformUserId: comment.from?.id ?? 'unknown',
    userHandle: comment.from?.name ?? 'unknown',
    userDisplayName: comment.from?.name ?? 'unknown',
    rawText: comment.message,
    timestamp: new Date(comment.created_time),
    parentCommentId: comment.parent?.id,
  };
}

// HMR recovery: restart any pollers whose timers were killed by module re-evaluation.
// The Map survives via globalThis but setTimeout callbacks are lost on HMR.
for (const [showId, state] of activePollers.entries()) {
  if (state.running) {
    // Clear stale timer from previous module evaluation to prevent duplicate poll loops
    if (state.timer) clearTimeout(state.timer);
    console.log(`[Polling ${showId}] HMR detected — restarting polling (cursor: ${state.afterCursor ?? 'none'}, seen: ${state.seenCommentIds.size})`);
    createPollLoop(showId, state);
  }
}
