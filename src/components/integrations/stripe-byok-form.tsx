'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { Loader2, XCircle } from 'lucide-react';

type StripeBYOKFormProps = {
  onConnected: () => void;
};

export function StripeBYOKForm({ onConnected }: StripeBYOKFormProps) {
  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setConnecting(true);
    setError(null);

    const res = await apiFetch<{ connected: boolean }>('/api/integrations/stripe/connect', {
      method: 'POST',
      body: JSON.stringify({ secretKey, publishableKey }),
    });

    if ('error' in res) {
      setError(res.error.message);
    } else {
      onConnected();
    }
    setConnecting(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Connect Your Stripe Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          Enter your Stripe API keys from your{' '}
          <a
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 underline"
          >
            Stripe Dashboard
          </a>
          . Keys are encrypted and stored securely.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Publishable Key
          </label>
          <Input
            type="password"
            placeholder="pk_live_..."
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Secret Key
          </label>
          <Input
            type="password"
            placeholder="sk_live_..."
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button
          onClick={handleConnect}
          disabled={connecting || !secretKey || !publishableKey}
        >
          {connecting ? (
            <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Validating...</>
          ) : (
            'Connect Stripe'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
