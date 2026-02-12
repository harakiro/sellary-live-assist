'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Play, Pause, Square, Plus, Monitor, Wifi, Radio, Check, Loader2, AlertTriangle, MessageSquare, Trash2 } from 'lucide-react';
import { InvoicePanel } from '@/components/integrations/invoice-panel';

type ShowItem = {
  id: string;
  itemNumber: string;
  title: string;
  description: string | null;
  totalQuantity: number;
  price: number | null;
  claimedCount: number;
  status: string;
};

type Show = {
  id: string;
  name: string;
  status: string;
  platform: 'facebook' | 'instagram' | null;
  connectionId: string | null;
  liveId: string | null;
  liveUrl: string | null;
  claimWord: string;
  passWord: string;
  autoNumberEnabled: boolean;
  autoNumberStart: number;
  startedAt: string | null;
  items: ShowItem[];
  stats: { totalClaims: number; winners: number; waitlisted: number; uniqueBuyers: number };
};

type Connection = {
  id: string;
  platform: 'facebook' | 'instagram';
  displayName: string | null;
  externalAccountId: string;
  status: string;
};

type LiveVideo = {
  id: string;
  title: string;
  status: string;
  permalink?: string;
};

function getNextItemNumber(items: { itemNumber: string }[], startNumber: number): string {
  if (items.length === 0) return String(startNumber);
  const nums = items.map(i => parseInt(i.itemNumber, 10)).filter(n => !isNaN(n));
  return nums.length > 0 ? String(Math.max(...nums) + 1) : String(startNumber);
}

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'active': return 'success' as const;
    case 'paused': return 'warning' as const;
    case 'ended': return 'secondary' as const;
    default: return 'outline' as const;
  }
};

export default function ShowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { workspace } = useAuth();
  const showId = params.id as string;
  const autoReplyEnabled = !!(workspace?.settings as Record<string, unknown> | null)?.autoReplyEnabled;

  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemNumber, setItemNumber] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [addingItem, setAddingItem] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);

  // Connection & live source state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<'facebook' | 'instagram' | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [lives, setLives] = useState<LiveVideo[]>([]);
  const [selectedLiveId, setSelectedLiveId] = useState<string>('');
  const [manualLiveId, setManualLiveId] = useState('');
  const [useManualId, setUseManualId] = useState(false);
  const [detectingLives, setDetectingLives] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [showActivatePrompt, setShowActivatePrompt] = useState(false);

  async function fetchShow() {
    const res = await apiFetch<Show>(`/api/shows/${showId}`);
    if ('data' in res) {
      setShow(res.data);
      // Sync local state from show data
      if (res.data.platform) setSelectedPlatform(res.data.platform);
      if (res.data.connectionId) setSelectedConnectionId(res.data.connectionId);
      if (res.data.liveId) setSelectedLiveId(res.data.liveId);
      // Pre-fill auto-number
      if (res.data.autoNumberEnabled) {
        setItemNumber(getNextItemNumber(res.data.items, res.data.autoNumberStart));
      }
    }
    setLoading(false);
  }

  async function fetchConnections() {
    const res = await apiFetch<Connection[]>('/api/connections');
    if ('data' in res) setConnections(res.data);
  }

  async function checkStripeConnection() {
    const res = await apiFetch<{ ok: boolean }>('/api/integrations/stripe');
    if ('data' in res) setStripeConnected(true);
  }

  useEffect(() => { fetchShow(); fetchConnections(); checkStripeConnection(); }, [showId]);

  async function addItem(e: FormEvent) {
    e.preventDefault();
    setAddingItem(true);
    const price = itemPrice ? Math.round(parseFloat(itemPrice) * 100) : null;
    await apiFetch(`/api/shows/${showId}/items`, {
      method: 'POST',
      body: JSON.stringify({ itemNumber, title: itemTitle, totalQuantity: itemQty, price }),
    });
    setItemTitle('');
    setItemPrice('');
    setItemQty(1);
    setAddingItem(false);
    fetchShow();
  }

  async function lifecycleAction(action: string) {
    await apiFetch(`/api/shows/${showId}/${action}`, { method: 'POST' });
    fetchShow();
  }

  async function detectLives() {
    if (!selectedConnectionId) return;
    setDetectingLives(true);
    setLives([]);
    const res = await apiFetch<LiveVideo[]>(`/api/connections/${selectedConnectionId}/lives`);
    if ('data' in res) {
      setLives(res.data);
      if (res.data.length === 0) setUseManualId(true);
    }
    setDetectingLives(false);
  }

  async function saveConnection() {
    const liveId = useManualId ? manualLiveId : selectedLiveId;
    if (!selectedPlatform || !selectedConnectionId) return;
    setSavingConnection(true);
    await apiFetch(`/api/shows/${showId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        platform: selectedPlatform,
        connectionId: selectedConnectionId,
        liveId: liveId || undefined,
      }),
    });
    setSavingConnection(false);
    fetchShow();
  }

  const filteredConnections = connections.filter(
    (c) => c.platform === selectedPlatform && c.status === 'active',
  );

  const connectedAccount = show?.connectionId
    ? connections.find((c) => c.id === show.connectionId)
    : null;

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>;
  }

  if (!show) {
    return <div className="text-center py-12 text-gray-500">Show not found</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{show.name}</h1>
            <Badge variant={statusBadgeVariant(show.status)}>{show.status}</Badge>
          </div>
          <p className="text-gray-500 mt-1">
            Claim: &quot;{show.claimWord}&quot; &middot; Pass: &quot;{show.passWord}&quot;
            <span className={`inline-flex items-center gap-1 ml-3 text-xs font-medium ${autoReplyEnabled ? 'text-green-600' : 'text-gray-400'}`}>
              <MessageSquare className="h-3 w-3" />
              Auto-reply: {autoReplyEnabled ? 'On' : 'Off'}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {(show.status === 'draft' || show.status === 'paused') && (
            <Button
              onClick={() => {
                if (show.status === 'draft' && (!show.connectionId || !show.liveId)) {
                  setShowActivatePrompt(true);
                  return;
                }
                lifecycleAction('activate');
              }}
              size="sm"
            >
              <Play className="h-4 w-4 mr-1" /> {show.status === 'draft' ? 'Start Show' : 'Resume'}
            </Button>
          )}
          {show.status === 'active' && (
            <>
              <Link href={`/shows/${showId}/console`}>
                <Button size="sm" variant="outline">
                  <Monitor className="h-4 w-4 mr-1" /> Console
                </Button>
              </Link>
              <Button onClick={() => lifecycleAction('pause')} size="sm" variant="outline">
                <Pause className="h-4 w-4 mr-1" /> Pause
              </Button>
              <Button onClick={() => lifecycleAction('stop')} size="sm" variant="destructive">
                <Square className="h-4 w-4 mr-1" /> End Show
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Activate confirmation prompt */}
      {showActivatePrompt && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                No sales channel or live source configured
              </p>
              <p className="text-sm text-amber-700 mt-1">
                You can set up a sales channel now, or start the show without one and add it later.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowActivatePrompt(false);
                    document.getElementById('connection-card')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Set Up Sales Channel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowActivatePrompt(false);
                    lifecycleAction('activate');
                  }}
                >
                  Start Without Sales Channel
                </Button>
                <button
                  type="button"
                  className="ml-2 text-sm text-amber-600 underline"
                  onClick={() => setShowActivatePrompt(false)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection & Live Source */}
      {(show.status === 'draft' || show.status === 'active') && (
        <Card id="connection-card" className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wifi className="h-5 w-5" /> Sales Channel &amp; Live Source
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Warning banner for active shows without connection */}
            {show.status === 'active' && !show.connectionId && (
              <div className="flex items-center gap-2 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  This show is active but has no sales channel. Comments won&apos;t be monitored until a live source is configured.
                </span>
              </div>
            )}

            {/* Already connected summary */}
            {connectedAccount && (
              <div className="flex items-center gap-2 text-sm bg-green-50 text-green-700 rounded-md px-3 py-2">
                <Check className="h-4 w-4" />
                <span>
                  Connected: {connectedAccount.displayName ?? connectedAccount.externalAccountId}
                  {show.liveId && <> &rarr; Live ID: {show.liveId}</>}
                </span>
              </div>
            )}

            {/* Platform selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <div className="flex gap-2">
                {(['facebook', 'instagram'] as const).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={selectedPlatform === p ? 'default' : 'outline'}
                    onClick={() => {
                      setSelectedPlatform(p);
                      setSelectedConnectionId('');
                      setLives([]);
                      setSelectedLiveId('');
                      setUseManualId(false);
                    }}
                  >
                    {p === 'facebook' ? 'Facebook' : 'Instagram'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Connection selector */}
            {selectedPlatform && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                {filteredConnections.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No active {selectedPlatform} sales channels.{' '}
                    <Link href="/sales-channels" className="text-brand-600 underline">
                      Link a page
                    </Link>
                  </p>
                ) : (
                  <select
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-brand-500"
                    value={selectedConnectionId}
                    onChange={(e) => {
                      setSelectedConnectionId(e.target.value);
                      setLives([]);
                      setSelectedLiveId('');
                      setUseManualId(false);
                    }}
                  >
                    <option value="">Select a connected page...</option>
                    {filteredConnections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName ?? c.externalAccountId}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Detect lives */}
            {selectedConnectionId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Live Video</label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={detectLives}
                  disabled={detectingLives}
                >
                  {detectingLives ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Detecting...</>
                  ) : (
                    <><Radio className="h-4 w-4 mr-1" /> Detect Active Lives</>
                  )}
                </Button>

                {/* Live list */}
                {lives.length > 0 && !useManualId && (
                  <div className="mt-2 space-y-1">
                    {lives.map((live) => (
                      <label
                        key={live.id}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                          selectedLiveId === live.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="liveVideo"
                          value={live.id}
                          checked={selectedLiveId === live.id}
                          onChange={() => setSelectedLiveId(live.id)}
                          className="text-brand-600"
                        />
                        <span className="font-medium">{live.title}</span>
                        <Badge variant="success" className="ml-auto text-xs">LIVE</Badge>
                      </label>
                    ))}
                    <button
                      type="button"
                      className="text-xs text-gray-500 underline mt-1"
                      onClick={() => setUseManualId(true)}
                    >
                      Enter ID manually instead
                    </button>
                  </div>
                )}

                {/* Manual ID input */}
                {useManualId && (
                  <div className="mt-2">
                    {lives.length === 0 && (
                      <p className="text-xs text-gray-500 mb-1">
                        No active broadcasts found. Enter a live video ID manually:
                      </p>
                    )}
                    <Input
                      placeholder="Live video ID (e.g. 123456789)"
                      value={manualLiveId}
                      onChange={(e) => setManualLiveId(e.target.value)}
                    />
                    {lives.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-gray-500 underline mt-1"
                        onClick={() => { setUseManualId(false); setManualLiveId(''); }}
                      >
                        Select from detected lives instead
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Save button */}
            {selectedPlatform && selectedConnectionId && (
              <Button
                onClick={saveConnection}
                disabled={savingConnection}
              >
                {savingConnection ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
                ) : (
                  'Save Sales Channel'
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Claims', value: show.stats.totalClaims },
          { label: 'Winners', value: show.stats.winners },
          { label: 'Waitlisted', value: show.stats.waitlisted },
          { label: 'Unique Buyers', value: show.stats.uniqueBuyers },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invoices (when Stripe connected and show has claims) */}
      {stripeConnected && show.stats.totalClaims > 0 && (
        <div className="mb-8">
          <InvoicePanel showId={showId} hasClaims={show.stats.totalClaims > 0} />
        </div>
      )}

      {/* Add Item Form */}
      {show.status === 'draft' && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Add Item</CardTitle>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={show.autoNumberEnabled}
                    onChange={async (e) => {
                      const enabled = e.target.checked;
                      await apiFetch(`/api/shows/${showId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ autoNumberEnabled: enabled }),
                      });
                      fetchShow();
                    }}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-700">Auto-number</span>
                </label>
                {show.autoNumberEnabled && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Start:</span>
                    <Input
                      type="number"
                      min={0}
                      value={show.autoNumberStart}
                      onChange={async (e) => {
                        const val = Number(e.target.value);
                        await apiFetch(`/api/shows/${showId}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ autoNumberStart: val }),
                        });
                        fetchShow();
                      }}
                      className="h-7 text-xs w-16"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={addItem} className="flex items-end gap-3">
              <div className="w-24">
                <label className="block text-sm font-medium text-gray-700 mb-1">Number</label>
                <Input
                  value={itemNumber}
                  onChange={(e) => setItemNumber(e.target.value)}
                  required
                  placeholder="101"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <Input
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  required
                  placeholder="Blue Floral Dress"
                />
              </div>
              <div className="w-24">
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  placeholder="$0.00"
                />
              </div>
              <div className="w-20">
                <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={itemQty}
                  onChange={(e) => setItemQty(Number(e.target.value))}
                />
              </div>
              <Button type="submit" disabled={addingItem}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Items ({show.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {show.items.length === 0 ? (
            <p className="text-sm text-gray-500">No items added yet.</p>
          ) : (
            <div className="divide-y">
              {show.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm font-bold text-gray-600 w-12">
                      #{item.itemNumber}
                    </span>
                    <div>
                      <div className="font-medium">
                        {item.title}
                        {item.price != null && (
                          <span className="ml-2 text-sm text-gray-500 font-normal">
                            ${(item.price / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.claimedCount}/{item.totalQuantity} claimed
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        item.status === 'sold_out' ? 'destructive' :
                        item.status === 'partial' ? 'warning' :
                        item.status === 'claimed' ? 'success' :
                        'outline'
                      }
                    >
                      {item.status.replace('_', ' ')}
                    </Badge>
                    {item.claimedCount === 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/shows/${showId}/items/${item.id}`, { method: 'DELETE' });
                          fetchShow();
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
