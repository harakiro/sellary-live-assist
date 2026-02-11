import { describe, it, expect } from 'vitest';
import { stripeAdapter } from '@/lib/integrations/stripe/index';

describe('Stripe Adapter', () => {
  describe('validateCredentials', () => {
    it('should reject missing keys', async () => {
      const result = await stripeAdapter.validateCredentials({});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject empty secret key', async () => {
      const result = await stripeAdapter.validateCredentials({
        secretKey: '',
        publishableKey: 'pk_test_abc',
      });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid secret key prefix', async () => {
      const result = await stripeAdapter.validateCredentials({
        secretKey: 'invalid_key',
        publishableKey: 'pk_test_abc',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sk_');
    });

    it('should reject invalid publishable key prefix', async () => {
      const result = await stripeAdapter.validateCredentials({
        secretKey: 'sk_test_abc',
        publishableKey: 'invalid_key',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('pk_');
    });

    // Note: Testing valid credentials requires a real Stripe API call
    // which we skip in unit tests. Integration tests would cover this.
  });

  it('should have correct adapter metadata', () => {
    expect(stripeAdapter.provider).toBe('stripe');
    expect(stripeAdapter.displayName).toBe('Stripe');
    expect(stripeAdapter.description).toBeTruthy();
  });

  it('should implement createInvoice method', () => {
    expect(stripeAdapter.createInvoice).toBeDefined();
    expect(typeof stripeAdapter.createInvoice).toBe('function');
  });

  it('should implement getInvoiceStatus method', () => {
    expect(stripeAdapter.getInvoiceStatus).toBeDefined();
    expect(typeof stripeAdapter.getInvoiceStatus).toBe('function');
  });
});
