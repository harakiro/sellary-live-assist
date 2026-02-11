import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from '@/lib/encryption';
import { randomBytes } from 'crypto';

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('hex');
});

describe('Stripe Credential Encryption', () => {
  it('should encrypt and decrypt Stripe credentials round-trip', () => {
    const credentials = {
      secretKey: 'sk_test_abc123def456',
      publishableKey: 'pk_test_xyz789',
    };

    const encrypted = encrypt(JSON.stringify(credentials));
    expect(encrypted).not.toContain('sk_test');
    expect(encrypted).not.toContain('pk_test');

    const decrypted = JSON.parse(decrypt(encrypted));
    expect(decrypted.secretKey).toBe(credentials.secretKey);
    expect(decrypted.publishableKey).toBe(credentials.publishableKey);
  });

  it('should produce different ciphertexts for same credentials', () => {
    const credentials = JSON.stringify({
      secretKey: 'sk_test_same',
      publishableKey: 'pk_test_same',
    });

    const a = encrypt(credentials);
    const b = encrypt(credentials);
    expect(a).not.toBe(b);

    // But both should decrypt to the same value
    expect(decrypt(a)).toBe(credentials);
    expect(decrypt(b)).toBe(credentials);
  });

  it('should handle credentials with special characters', () => {
    const credentials = JSON.stringify({
      secretKey: 'sk_test_with+special/chars=',
      publishableKey: 'pk_test_with+special/chars=',
    });

    const encrypted = encrypt(credentials);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(credentials);
  });
});
