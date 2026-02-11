'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { StripeBYOKForm } from '@/components/integrations/stripe-byok-form';
import { CheckCircle, XCircle, Loader2, ArrowLeft, Trash2 } from 'lucide-react';

export default function StripeIntegrationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    const res = await apiFetch<{ ok: boolean; provider: string }>('/api/integrations/stripe');
    if ('data' in res) {
      setConnected(true);
    } else {
      setConnected(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    const res = await apiFetch<{ ok: boolean; error?: string }>('/api/integrations/stripe');
    if ('data' in res) {
      setTestResult(res.data);
    } else {
      setTestResult({ ok: false, error: res.error.message });
    }
    setTesting(false);
  }

  async function disconnect() {
    setDisconnecting(true);
    await apiFetch('/api/integrations/stripe', { method: 'DELETE' });
    setConnected(false);
    setTestResult(null);
    setDisconnecting(false);
  }

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
        <button
          onClick={() => router.push('/integrations')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Integrations
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Stripe</h1>
          {connected && <Badge variant="success">Connected</Badge>}
        </div>
        <p className="text-gray-500 mt-1">
          Accept payments and generate invoices for claimed items.
        </p>
      </div>

      {connected ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connection Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm bg-green-50 text-green-700 rounded-md px-3 py-2">
                <CheckCircle className="h-4 w-4" />
                Stripe is connected and active.
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Testing...</>
                  ) : (
                    'Test Connection'
                  )}
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={disconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Disconnecting...</>
                  ) : (
                    <><Trash2 className="h-4 w-4 mr-1" /> Disconnect</>
                  )}
                </Button>
              </div>

              {testResult && (
                <div
                  className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
                    testResult.ok
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  {testResult.ok ? (
                    <><CheckCircle className="h-4 w-4" /> Connection is healthy</>
                  ) : (
                    <><XCircle className="h-4 w-4" /> {testResult.error || 'Test failed'}</>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <StripeBYOKForm onConnected={() => { setConnected(true); }} />
      )}
    </div>
  );
}
