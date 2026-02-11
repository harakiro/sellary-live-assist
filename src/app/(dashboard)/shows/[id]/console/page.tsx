'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRealtime } from '@/hooks/use-websocket';
import { apiFetch } from '@/lib/api-client';
import { ItemsPanel } from '@/components/console/items-panel';
import { ClaimFeed } from '@/components/console/claim-feed';
import { CommentStream } from '@/components/console/comment-stream';
import { StatusBar } from '@/components/console/status-bar';
import type { RealtimeEvent } from '@/lib/realtime/events';

type ShowData = {
  id: string;
  name: string;
  status: string;
  startedAt: string | null;
  claimWord: string;
  items: Array<{
    id: string;
    itemNumber: string;
    title: string;
    totalQuantity: number;
    claimedCount: number;
    status: string;
  }>;
  stats: { totalClaims: number; winners: number; waitlisted: number; uniqueBuyers: number };
};

type ClaimEntry = {
  id: string;
  itemNumber: string;
  userHandle: string;
  claimStatus: string;
  waitlistPosition?: number;
  timestamp: string;
};

type CommentEntry = {
  id: string;
  userHandle: string;
  text: string;
  parsed: boolean;
  isReply?: boolean;
  parentCommentId?: string;
  timestamp: string;
};

/**
 * Re-order a flat list of comments so replies sit directly after their parent.
 * Preserves the original order for top-level comments.
 */
function threadComments(flat: CommentEntry[]): CommentEntry[] {
  const topLevel: CommentEntry[] = [];
  const replyMap = new Map<string, CommentEntry[]>();

  for (const c of flat) {
    if (c.isReply && c.parentCommentId) {
      const group = replyMap.get(c.parentCommentId) || [];
      group.push(c);
      replyMap.set(c.parentCommentId, group);
    } else {
      topLevel.push(c);
    }
  }

  const result: CommentEntry[] = [];
  for (const c of topLevel) {
    result.push(c);
    const replies = replyMap.get(c.id);
    if (replies) {
      result.push(...replies);
      replyMap.delete(c.id);
    }
  }

  // Orphan replies whose parent isn't in the current page — prepend them
  for (const replies of replyMap.values()) {
    result.unshift(...replies);
  }

  return result;
}

export default function ConsolePage() {
  const params = useParams();
  const showId = params.id as string;

  const [show, setShow] = useState<ShowData | null>(null);
  const [claimEntries, setClaimEntries] = useState<ClaimEntry[]>([]);
  const [commentEntries, setCommentEntries] = useState<CommentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefillItemNumber, setPrefillItemNumber] = useState<string | null>(null);

  const fetchShow = useCallback(async () => {
    const res = await apiFetch<ShowData>(`/api/shows/${showId}`);
    if ('data' in res) setShow(res.data);
    setLoading(false);
  }, [showId]);

  const fetchClaims = useCallback(async () => {
    const res = await apiFetch<ClaimEntry[]>(`/api/shows/${showId}/claims`);
    if ('data' in res) setClaimEntries(res.data);
  }, [showId]);

  const fetchComments = useCallback(async () => {
    const res = await apiFetch<CommentEntry[]>(`/api/shows/${showId}/comments?limit=200`);
    if ('data' in res) setCommentEntries(threadComments(res.data));
  }, [showId]);

  useEffect(() => {
    fetchShow();
    fetchClaims();
    fetchComments();
  }, [fetchShow, fetchClaims, fetchComments]);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case 'claim.created':
        setClaimEntries((prev) => {
          if (prev.some((c) => c.id === event.data.claimId)) return prev;
          return [
            {
              id: event.data.claimId,
              itemNumber: event.data.itemNumber,
              userHandle: event.data.userHandle,
              claimStatus: event.data.claimStatus,
              waitlistPosition: event.data.waitlistPosition,
              timestamp: event.data.timestamp,
            },
            ...prev,
          ];
        });
        // Refresh show to update item counts
        fetchShow();
        break;
      case 'claim.released':
        setClaimEntries((prev) =>
          prev.map((c) =>
            c.id === event.data.claimId ? { ...c, claimStatus: 'released' } : c,
          ),
        );
        fetchShow();
        break;
      case 'comment.received': {
        const commentId = event.data.commentId || `c-${Date.now()}`;
        const entry: CommentEntry = {
          id: commentId,
          userHandle: event.data.userHandle,
          text: event.data.text,
          parsed: event.data.parsed,
          isReply: event.data.isReply,
          parentCommentId: event.data.parentCommentId,
          timestamp: event.data.timestamp,
        };
        setCommentEntries((prev) => {
          if (prev.some((c) => c.id === commentId)) return prev;
          // Insert replies right after their parent comment
          if (entry.isReply && entry.parentCommentId) {
            const parentIdx = prev.findIndex((c) => c.id === entry.parentCommentId);
            if (parentIdx !== -1) {
              // Find the last consecutive reply under this parent to insert after
              let insertIdx = parentIdx + 1;
              while (insertIdx < prev.length && prev[insertIdx].parentCommentId === entry.parentCommentId) {
                insertIdx++;
              }
              const next = [...prev];
              next.splice(insertIdx, 0, entry);
              return next;
            }
          }
          return [entry, ...prev];
        });
        break;
      }
      case 'unmatched.resolved':
        // Update resolved claims from 'unmatched' to their new status
        setClaimEntries((prev) =>
          prev.map((c) => {
            if (event.data.winners.includes(c.id)) {
              return { ...c, claimStatus: 'winner' };
            }
            if (event.data.waitlisted.includes(c.id)) {
              return { ...c, claimStatus: 'waitlist' };
            }
            return c;
          }),
        );
        fetchShow();
        break;
      case 'item.updated':
        fetchShow();
        break;
      case 'session.status':
        setShow((prev) => (prev ? { ...prev, status: event.data.status } : prev));
        break;
    }
  }, [fetchShow]);

  const { connected } = useRealtime({
    showId,
    onEvent: handleEvent,
    enabled: !!show && show.status === 'active',
  });

  // Polling fallback: refresh data every 5s when SSE is not connected
  useEffect(() => {
    if (connected || !show || show.status !== 'active') return;
    const interval = setInterval(() => {
      fetchShow();
      fetchClaims();
      fetchComments();
    }, 3000);
    return () => clearInterval(interval);
  }, [connected, show, fetchShow, fetchClaims, fetchComments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!show) {
    return <div className="text-center py-12 text-gray-500">Show not found</div>;
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col -m-8">
      <StatusBar
        showName={show.name}
        status={show.status}
        startedAt={show.startedAt}
        totalItems={show.items.length}
        claimedItems={show.stats.winners}
        uniqueBuyers={show.stats.uniqueBuyers}
        connected={connected}
        showId={showId}
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r overflow-y-auto bg-white">
          <ItemsPanel
            items={show.items}
            showId={showId}
            onRefresh={fetchShow}
            prefillItemNumber={prefillItemNumber}
            onPrefillConsumed={() => setPrefillItemNumber(null)}
          />
        </div>
        <div className="flex-1 overflow-y-auto bg-white">
          <ClaimFeed
            entries={claimEntries}
            onCreateItem={(itemNumber) => setPrefillItemNumber(itemNumber)}
          />
        </div>
        <div className="w-80 border-l overflow-y-auto bg-white">
          <CommentStream entries={commentEntries} />
        </div>
      </div>
    </div>
  );
}
