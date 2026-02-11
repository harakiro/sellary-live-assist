import { describe, it, expect, beforeEach } from 'vitest';
import { registerAdapter, getAdapter, listAdapters, hasAdapter } from '@/lib/integrations/registry';
import type { IntegrationAdapter } from '@/lib/integrations/types';

// We need to test the registry, but it uses a module-level Map that persists.
// We'll test by registering test adapters.

describe('Integration Registry', () => {
  const mockAdapter: IntegrationAdapter = {
    provider: 'stripe',
    displayName: 'Stripe',
    description: 'Test adapter',
    async validateCredentials() { return { valid: true }; },
    async testConnection() { return { ok: true }; },
  };

  it('should register and retrieve an adapter', () => {
    registerAdapter(mockAdapter);
    const adapter = getAdapter('stripe');
    expect(adapter).toBeDefined();
    expect(adapter?.provider).toBe('stripe');
    expect(adapter?.displayName).toBe('Stripe');
  });

  it('should return undefined for unregistered provider', () => {
    const adapter = getAdapter('shopify');
    expect(adapter).toBeUndefined();
  });

  it('should list all registered adapters', () => {
    registerAdapter(mockAdapter);
    const adapters = listAdapters();
    expect(adapters.length).toBeGreaterThanOrEqual(1);
    expect(adapters.some(a => a.provider === 'stripe')).toBe(true);
  });

  it('should check if adapter exists', () => {
    registerAdapter(mockAdapter);
    expect(hasAdapter('stripe')).toBe(true);
    expect(hasAdapter('square')).toBe(false);
  });

  it('should overwrite adapter on re-register', () => {
    const updated: IntegrationAdapter = {
      ...mockAdapter,
      displayName: 'Stripe Updated',
    };
    registerAdapter(updated);
    const adapter = getAdapter('stripe');
    expect(adapter?.displayName).toBe('Stripe Updated');
  });
});
