'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api-client';

type WorkspaceSettings = {
  defaultClaimWord?: string;
  defaultPassWord?: string;
  defaultPollingInterval?: number;
};

export default function SettingsPage() {
  const { workspace } = useAuth();
  const [name, setName] = useState('');
  const [claimWord, setClaimWord] = useState('sold');
  const [passWord, setPassWord] = useState('pass');
  const [pollingInterval, setPollingInterval] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name);
    const settings = workspace.settings as WorkspaceSettings | null;
    if (settings) {
      setClaimWord(settings.defaultClaimWord || 'sold');
      setPassWord(settings.defaultPassWord || 'pass');
      setPollingInterval(settings.defaultPollingInterval || 2);
    }
  }, [workspace]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    setSaving(true);
    setSaved(false);

    await apiFetch(`/api/workspaces/${workspace.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name,
        settings: {
          defaultClaimWord: claimWord,
          defaultPassWord: passWord,
          defaultPollingInterval: pollingInterval,
        },
      }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your workspace</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workspace Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workspace Name
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Claim Word
                </label>
                <Input value={claimWord} onChange={(e) => setClaimWord(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Used for new shows</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Pass Word
                </label>
                <Input value={passWord} onChange={(e) => setPassWord(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Polling Interval (seconds)
              </label>
              <Input
                type="number"
                min={2}
                max={10}
                value={pollingInterval}
                onChange={(e) => setPollingInterval(Number(e.target.value))}
              />
              <p className="text-xs text-gray-400 mt-1">
                How often to check for new comments (2-10 seconds)
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
              {saved && <span className="text-sm text-green-600">Saved!</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
