'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';

export default function NewShowPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [claimWord, setClaimWord] = useState('sold');
  const [passWord, setPassWord] = useState('pass');
  const [autoNumberEnabled, setAutoNumberEnabled] = useState(false);
  const [autoNumberStart, setAutoNumberStart] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await apiFetch<{ id: string }>('/api/shows', {
      method: 'POST',
      body: JSON.stringify({ name, claimWord, passWord, autoNumberEnabled, autoNumberStart }),
    });

    if ('data' in res) {
      router.push(`/shows/${res.data.id}`);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Show</h1>
        <p className="text-gray-500 mt-1">Set up a new live sale session</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Show Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
            )}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Show Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Friday Night Live Sale"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="claimWord" className="block text-sm font-medium text-gray-700 mb-1">
                  Claim Word
                </label>
                <Input
                  id="claimWord"
                  value={claimWord}
                  onChange={(e) => setClaimWord(e.target.value)}
                  placeholder="sold"
                />
                <p className="text-xs text-gray-500 mt-1">e.g. &quot;sold 123&quot;</p>
              </div>
              <div>
                <label htmlFor="passWord" className="block text-sm font-medium text-gray-700 mb-1">
                  Pass Word
                </label>
                <Input
                  id="passWord"
                  value={passWord}
                  onChange={(e) => setPassWord(e.target.value)}
                  placeholder="pass"
                />
                <p className="text-xs text-gray-500 mt-1">e.g. &quot;pass 123&quot;</p>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoNumberEnabled}
                  onChange={(e) => setAutoNumberEnabled(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-gray-700">Auto-number items</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">Automatically assign sequential item numbers</p>
              {autoNumberEnabled && (
                <div className="mt-2 w-40">
                  <label htmlFor="autoNumberStart" className="block text-sm font-medium text-gray-700 mb-1">
                    Starting Number
                  </label>
                  <Input
                    id="autoNumberStart"
                    type="number"
                    min={0}
                    value={autoNumberStart}
                    onChange={(e) => setAutoNumberStart(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Show'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
