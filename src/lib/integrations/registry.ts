import type { IntegrationAdapter, IntegrationProvider } from './types';

const adapters = new Map<IntegrationProvider, IntegrationAdapter>();

export function registerAdapter(adapter: IntegrationAdapter): void {
  adapters.set(adapter.provider, adapter);
}

export function getAdapter(provider: IntegrationProvider): IntegrationAdapter | undefined {
  return adapters.get(provider);
}

export function listAdapters(): IntegrationAdapter[] {
  return Array.from(adapters.values());
}

export function hasAdapter(provider: IntegrationProvider): boolean {
  return adapters.has(provider);
}
