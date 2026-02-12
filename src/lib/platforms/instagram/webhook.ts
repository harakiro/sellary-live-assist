import { createHmac } from 'crypto';
import type { CommentEvent } from '../types';

/**
 * Verify the HMAC-SHA256 signature on an incoming Instagram webhook payload.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  appSecret: string,
): boolean {
  if (!signature.startsWith('sha256=')) return false;

  const expected = createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  return `sha256=${expected}` === signature;
}

type IGWebhookPayload = {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    changes: Array<{
      field: string;
      value: {
        from: { id: string; username: string; self_ig_scoped_id?: string };
        media: { id: string; media_product_type?: string };
        id: string;
        text: string;
        timestamp?: string;
      };
    }>;
  }>;
};

/**
 * Parse an Instagram webhook payload and extract comment events.
 * Filters for live_comments field only.
 */
export function parseWebhookPayload(body: IGWebhookPayload): CommentEvent[] {
  const events: CommentEvent[] = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'live_comments') continue;

      const val = change.value;
      if (!val || !val.from || !val.text) continue;

      events.push({
        platform: 'instagram',
        liveId: val.media?.id || entry.id,
        commentId: val.id || `ig-${Date.now()}`,
        userId: val.from.id,
        userHandle: val.from.username || val.from.id,
        userDisplayName: val.from.username || '',
        text: val.text,
        timestamp: val.timestamp ? new Date(val.timestamp) : new Date(entry.time * 1000),
      });
    }
  }

  return events;
}
