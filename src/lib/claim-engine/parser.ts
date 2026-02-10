import type { ParseResult } from './types';

/**
 * Normalize a comment for pattern matching.
 * - Lowercase
 * - Strip emoji and non-ASCII
 * - Strip punctuation (keep alphanumeric and spaces)
 * - Collapse whitespace
 * - Trim
 */
export function normalizeComment(text: string): string {
  return (
    text
      .toLowerCase()
      // Remove emoji and non-ASCII characters
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
      .replace(/[^\x00-\x7F]/g, '')
      // Strip punctuation, keep letters/digits/spaces
      .replace(/[^a-z0-9\s]/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Parse a normalized comment for claim or pass intent.
 *
 * Patterns matched (where WORD is the claim/pass word):
 * - "WORD N" — e.g. "sold 123"
 * - "N WORD" — e.g. "123 sold"
 * - "WORDN"  — e.g. "sold123" (no space)
 *
 * Returns the first match found, or null.
 */
export function parseComment(
  normalizedText: string,
  claimWord = 'sold',
  passWord = 'pass',
): ParseResult {
  if (!normalizedText) return null;

  const claim = matchPattern(normalizedText, claimWord);
  if (claim) {
    return { type: 'claim', itemNumber: claim, rawText: normalizedText };
  }

  const pass = matchPattern(normalizedText, passWord);
  if (pass) {
    return { type: 'pass', itemNumber: pass, rawText: normalizedText };
  }

  return null;
}

function matchPattern(text: string, word: string): string | null {
  // Pattern: "word N" (e.g. "sold 123")
  const wordFirst = new RegExp(`\\b${escapeRegex(word)}\\s+(\\d+)\\b`);
  const m1 = text.match(wordFirst);
  if (m1) return m1[1];

  // Pattern: "wordN" (no space, e.g. "sold123")
  const wordConcat = new RegExp(`\\b${escapeRegex(word)}(\\d+)\\b`);
  const m2 = text.match(wordConcat);
  if (m2) return m2[1];

  // Pattern: "N word" (e.g. "123 sold")
  const numberFirst = new RegExp(`\\b(\\d+)\\s+${escapeRegex(word)}\\b`);
  const m3 = text.match(numberFirst);
  if (m3) return m3[1];

  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
