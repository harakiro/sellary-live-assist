import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from '@/lib/encryption';
import { randomBytes } from 'crypto';

beforeAll(() => {
  // Set a test encryption key (32 bytes = 64 hex chars)
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('hex');
});

describe('encryption', () => {
  it('should encrypt and decrypt a string correctly', () => {
    const plaintext = 'EAAGxxxxxxxxxx_test_access_token';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext', () => {
    const plaintext = 'same-text';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it('should handle empty strings', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle unicode characters', () => {
    const plaintext = 'token_with_emoji_🔥_and_中文';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should fail to decrypt with a different key', () => {
    const plaintext = 'secret-token';
    const encrypted = encrypt(plaintext);

    // Change the key
    const originalKey = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('hex');

    expect(() => decrypt(encrypted)).toThrow();

    process.env.TOKEN_ENCRYPTION_KEY = originalKey;
  });

  it('should fail to decrypt tampered ciphertext', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    // Tamper with the data portion
    parts[2] = 'AAAA' + parts[2].slice(4);
    const tampered = parts.join(':');

    expect(() => decrypt(tampered)).toThrow();
  });
});
