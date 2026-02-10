'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { Trash2 } from 'lucide-react';

type Connection = {
  id: string;
  platform: string;
  externalAccountId: string;
  displayName: string | null;
  status: string;
  tokenExpiresAt: string | null;
  createdAt: string;
};

export default function ConnectionsPage() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const success = searchParams.get('success');
  const error = searchParams.get('error');

  const fetchConnections = useCallback(async () => {
    const res = await apiFetch<Connection[]>('/api/connections');
    if ('data' in res) setConnections(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  async function connectPlatform(platform: 'facebook' | 'instagram') {
    const res = await apiFetch<{ authUrl: string }>(`/api/connections/oauth/${platform}/start`);
    if ('data' in res) {
      window.location.href = res.data.authUrl;
    }
  }

  async function disconnect(id: string) {
    await apiFetch(`/api/connections/${id}`, { method: 'DELETE' });
    fetchConnections();
  }

  function daysUntilExpiry(expiresAt: string | null): string | null {
    if (!expiresAt) return null;
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
    if (days < 0) return 'Expired';
    if (days === 0) return 'Expires today';
    return `${days}d remaining`;
  }

  const fbConnections = connections.filter((c) => c.platform === 'facebook');
  const igConnections = connections.filter((c) => c.platform === 'instagram');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
        <p className="text-gray-500 mt-1">Connect your social media accounts</p>
      </div>

      {success && (
        <div className="mb-6 bg-green-50 text-green-700 p-3 rounded-md text-sm">
          Successfully connected {success} account(s).
        </div>
      )}
      {error && (
        <div className="mb-6 bg-red-50 text-red-700 p-3 rounded-md text-sm">
          Connection failed: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Facebook Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Connect a Facebook Page to monitor live broadcasts
            </p>
            <Button variant="outline" onClick={() => connectPlatform('facebook')}>
              Connect Facebook Page
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Instagram Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Connect an Instagram Professional account
            </p>
            <Button variant="outline" onClick={() => connectPlatform('instagram')}>
              Connect Instagram
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Connected accounts list */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600 mx-auto" />
        </div>
      ) : connections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connected Accounts ({connections.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {connections.map((conn) => {
                const expiry = daysUntilExpiry(conn.tokenExpiresAt);
                return (
                  <div key={conn.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={conn.platform === 'facebook' ? 'default' : 'secondary'}>
                        {conn.platform}
                      </Badge>
                      <div>
                        <div className="font-medium">{conn.displayName || conn.externalAccountId}</div>
                        <div className="text-xs text-gray-400">
                          Connected {new Date(conn.createdAt).toLocaleDateString()}
                          {expiry && (
                            <span
                              className={expiry === 'Expired' ? 'text-red-500 ml-2' : 'ml-2'}
                            >
                              &middot; {expiry}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={conn.status === 'active' ? 'success' : 'destructive'}
                        className="text-[10px]"
                      >
                        {conn.status}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => disconnect(conn.id)}>
                        <Trash2 className="h-4 w-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8 text-gray-500 text-sm">
          No accounts connected yet. Use the buttons above to get started.
        </div>
      )}
    </div>
  );
}
