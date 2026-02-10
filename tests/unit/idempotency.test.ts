import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey } from '@/lib/claim-engine/idempotency';

describe('generateIdempotencyKey', () => {
  it('should produce consistent keys for same commentId', () => {
    const key1 = generateIdempotencyKey({ platform: 'facebook', commentId: 'abc123' });
    const key2 = generateIdempotencyKey({ platform: 'facebook', commentId: 'abc123' });
    expect(key1).toBe(key2);
  });

  it('should produce different keys for different commentIds', () => {
    const key1 = generateIdempotencyKey({ platform: 'facebook', commentId: 'abc123' });
    const key2 = generateIdempotencyKey({ platform: 'facebook', commentId: 'def456' });
    expect(key1).not.toBe(key2);
  });

  it('should produce different keys for different platforms', () => {
    const key1 = generateIdempotencyKey({ platform: 'facebook', commentId: 'abc123' });
    const key2 = generateIdempotencyKey({ platform: 'instagram', commentId: 'abc123' });
    expect(key1).not.toBe(key2);
  });

  it('should use fallback strategy when no commentId', () => {
    const key = generateIdempotencyKey({
      platform: 'instagram',
      liveId: 'live_1',
      platformUserId: 'user_1',
      normalizedText: 'sold 123',
      timestamp: new Date('2025-01-01T00:00:00Z'),
    });
    expect(key).toBeTruthy();
    expect(typeof key).toBe('string');
    expect(key.length).toBe(64); // SHA-256 hex
  });

  it('should produce same fallback key within same 10s bucket', () => {
    const key1 = generateIdempotencyKey({
      platform: 'instagram',
      liveId: 'live_1',
      platformUserId: 'user_1',
      normalizedText: 'sold 123',
      timestamp: new Date('2025-01-01T00:00:01Z'),
    });
    const key2 = generateIdempotencyKey({
      platform: 'instagram',
      liveId: 'live_1',
      platformUserId: 'user_1',
      normalizedText: 'sold 123',
      timestamp: new Date('2025-01-01T00:00:09Z'),
    });
    expect(key1).toBe(key2);
  });

  it('should produce different fallback key for different 10s buckets', () => {
    const key1 = generateIdempotencyKey({
      platform: 'instagram',
      liveId: 'live_1',
      platformUserId: 'user_1',
      normalizedText: 'sold 123',
      timestamp: new Date('2025-01-01T00:00:01Z'),
    });
    const key2 = generateIdempotencyKey({
      platform: 'instagram',
      liveId: 'live_1',
      platformUserId: 'user_1',
      normalizedText: 'sold 123',
      timestamp: new Date('2025-01-01T00:00:15Z'),
    });
    expect(key1).not.toBe(key2);
  });
});
