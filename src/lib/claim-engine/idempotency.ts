import { createHash } from 'crypto';

/**
 * Generate an idempotency key for a claim.
 *
 * Primary strategy (when commentId is available):
 *   hash(platform + commentId)
 *
 * Fallback (webhook without commentId):
 *   hash(platform + liveId + platformUserId + normalizedText + timestampBucket10s)
 */
export function generateIdempotencyKey(params: {
  platform: string;
  commentId?: string;
  liveId?: string;
  platformUserId?: string;
  normalizedText?: string;
  timestamp?: Date;
}): string {
  const { platform, commentId, liveId, platformUserId, normalizedText, timestamp } = params;

  let input: string;
  if (commentId) {
    input = `${platform}:${commentId}`;
  } else {
    const bucket = timestamp
      ? Math.floor(timestamp.getTime() / 10000).toString()
      : '0';
    input = `${platform}:${liveId}:${platformUserId}:${normalizedText}:${bucket}`;
  }

  return createHash('sha256').update(input).digest('hex');
}
