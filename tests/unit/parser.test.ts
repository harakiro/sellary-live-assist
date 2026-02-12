import { describe, it, expect } from 'vitest';
import { normalizeComment, parseComment } from '@/lib/claim-engine/parser';

describe('normalizeComment', () => {
  it('should lowercase text', () => {
    expect(normalizeComment('SOLD 123')).toBe('sold 123');
  });

  it('should strip emoji', () => {
    expect(normalizeComment('sold 123 🔥🔥')).toBe('sold 123');
  });

  it('should strip punctuation', () => {
    expect(normalizeComment('sold #123!')).toBe('sold 123');
  });

  it('should collapse whitespace', () => {
    expect(normalizeComment('sold   123')).toBe('sold 123');
  });

  it('should trim', () => {
    expect(normalizeComment('  sold 123  ')).toBe('sold 123');
  });

  it('should handle empty string', () => {
    expect(normalizeComment('')).toBe('');
  });
});

describe('parseComment', () => {
  it('should match "sold 123"', () => {
    const result = parseComment('sold 123');
    expect(result).toEqual({ type: 'claim', itemNumber: '123', rawText: 'sold 123' });
  });

  it('should match "123 sold"', () => {
    const result = parseComment('123 sold');
    expect(result).toEqual({ type: 'claim', itemNumber: '123', rawText: '123 sold' });
  });

  it('should match "sold123" (no space)', () => {
    const result = parseComment('sold123');
    expect(result).toEqual({ type: 'claim', itemNumber: '123', rawText: 'sold123' });
  });

  it('should match "sold 456" (different number)', () => {
    const result = parseComment('sold 456');
    expect(result).toEqual({ type: 'claim', itemNumber: '456', rawText: 'sold 456' });
  });

  it('should match "pass 123"', () => {
    const result = parseComment('pass 123');
    expect(result).toEqual({ type: 'pass', itemNumber: '123', rawText: 'pass 123' });
  });

  it('should match "123 pass"', () => {
    const result = parseComment('123 pass');
    expect(result).toEqual({ type: 'pass', itemNumber: '123', rawText: '123 pass' });
  });

  it('should return null for "hello everyone"', () => {
    expect(parseComment('hello everyone')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseComment('')).toBeNull();
  });

  it('should return null for "sold" (no number)', () => {
    expect(parseComment('sold')).toBeNull();
  });

  it('should return null for "123" (no keyword)', () => {
    expect(parseComment('123')).toBeNull();
  });

  it('should return first match for "sold 123 and sold 456"', () => {
    const result = parseComment('sold 123 and sold 456');
    expect(result).toEqual({ type: 'claim', itemNumber: '123', rawText: 'sold 123 and sold 456' });
  });

  it('should work with custom claim word', () => {
    const result = parseComment('mine 123', 'mine', 'pass');
    expect(result).toEqual({ type: 'claim', itemNumber: '123', rawText: 'mine 123' });
  });

  it('should work with custom pass word', () => {
    const result = parseComment('skip 123', 'sold', 'skip');
    expect(result).toEqual({ type: 'pass', itemNumber: '123', rawText: 'skip 123' });
  });

  it('should prioritize claim over pass when both match', () => {
    // "sold 123" contains claim word, should match as claim
    const result = parseComment('sold 123');
    expect(result?.type).toBe('claim');
  });

  it('should handle multi-digit item numbers', () => {
    const result = parseComment('sold 99999');
    expect(result).toEqual({ type: 'claim', itemNumber: '99999', rawText: 'sold 99999' });
  });

  it('should handle single-digit item numbers', () => {
    const result = parseComment('sold 1');
    expect(result).toEqual({ type: 'claim', itemNumber: '1', rawText: 'sold 1' });
  });

  it('should match "pass on 50"', () => {
    const result = parseComment('pass on 50');
    expect(result).toEqual({ type: 'pass', itemNumber: '50', rawText: 'pass on 50' });
  });

  it('should match "sold on 123"', () => {
    const result = parseComment('sold on 123');
    expect(result).toEqual({ type: 'claim', itemNumber: '123', rawText: 'sold on 123' });
  });
});

describe('normalizeComment + parseComment integration', () => {
  it('should handle "SOLD 123" end-to-end', () => {
    const normalized = normalizeComment('SOLD 123');
    const result = parseComment(normalized);
    expect(result).toEqual({ type: 'claim', itemNumber: '123', rawText: 'sold 123' });
  });

  it('should handle "sold 123 🔥🔥" end-to-end', () => {
    const normalized = normalizeComment('sold 123 🔥🔥');
    const result = parseComment(normalized);
    expect(result).toEqual({ type: 'claim', itemNumber: '123', rawText: 'sold 123' });
  });

  it('should handle "sold #123!" end-to-end', () => {
    const normalized = normalizeComment('sold #123!');
    const result = parseComment(normalized);
    expect(result).toEqual({ type: 'claim', itemNumber: '123', rawText: 'sold 123' });
  });

  it('should handle "  PASS  456  " end-to-end', () => {
    const normalized = normalizeComment('  PASS  456  ');
    const result = parseComment(normalized);
    expect(result).toEqual({ type: 'pass', itemNumber: '456', rawText: 'pass 456' });
  });
});
