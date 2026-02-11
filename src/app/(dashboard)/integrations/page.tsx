'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';
import { IntegrationTile } from '@/components/integrations/integration-tile';

type IntegrationInfo = {
  provider: string;
  displayName: string;
  description: string;
  connected: boolean;
  status: string;
  connectedAt: string | null;
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await apiFetch<IntegrationInfo[]>('/api/integrations');
      if ('data' in res) setIntegrations(res.data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">
          Connect third-party services to enhance your live selling workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => (
          <IntegrationTile
            key={integration.provider}
            provider={integration.provider}
            displayName={integration.displayName}
            description={integration.description}
            connected={integration.connected}
            status={integration.status}
            comingSoon={integration.status === 'coming_soon'}
          />
        ))}
      </div>
    </div>
  );
}
