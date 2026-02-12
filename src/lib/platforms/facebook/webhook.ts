import { createHmac } from 'crypto';
import type { CommentEvent } from '../types';

/**
 * Verify the HMAC-SHA256 signature on an incoming Facebook webhook payload.
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

type FBWebhookPayload = {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    changes?: Array<{
      field: string;
      value: {
        from?: { id: string; name: string };
        message?: string;
        created_time?: string;
        id?: string;
        video_id?: string;
      };
    }>;
  }>;
};

/**
 * Parse a Facebook Page webhook payload and extract live comment events.
 * Handles the `live_comments` change field.
 */
export function parseWebhookPayload(body: FBWebhookPayload): CommentEvent[] {
  const events: CommentEvent[] = [];

  if (body.object !== 'page') return events;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'live_comments') continue;

      const val = change.value;
      if (!val || !val.from || !val.message) continue;

      events.push({
        platform: 'facebook',
        liveId: val.video_id || entry.id,
        commentId: val.id || `fb-${Date.now()}`,
        userId: val.from.id,
        userHandle: val.from.name,
        userDisplayName: val.from.name,
        text: val.message,
        timestamp: val.created_time ? new Date(val.created_time) : new Date(entry.time * 1000),
      });
    }
  }

  return events;
}
