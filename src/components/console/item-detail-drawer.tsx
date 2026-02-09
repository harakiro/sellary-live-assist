'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { X } from 'lucide-react';

type Claim = {
  id: string;
  userHandle: string;
  userDisplayName: string;
  claimStatus: string;
  waitlistPosition: number | null;
  createdAt: string;
};

type ItemDetailDrawerProps = {
  item: { id: string; itemNumber: string; title: string; totalQuantity: number; claimedCount: number; status: string };
  showId: string;
  onClose: () => void;
  onRefresh: () => void;
};

export function ItemDetailDrawer({ item, showId, onClose, onRefresh }: ItemDetailDrawerProps) {
  const [claimsData, setClaimsData] = useState<Claim[]>([]);
  const [awardHandle, setAwardHandle] = useState('');
  const [awarding, setAwarding] = useState(false);

  useEffect(() => {
    async function fetchClaims() {
      const res = await apiFetch<Claim[]>(
        `/api/shows/${showId}/claims?item_number=${item.itemNumber}`,
      );
      if ('data' in res) setClaimsData(res.data);
    }
    fetchClaims();
  }, [showId, item.itemNumber]);

  const winners = claimsData.filter((c) => c.claimStatus === 'winner');
  const waitlist = claimsData
    .filter((c) => c.claimStatus === 'waitlist')
    .sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0));

  async function handleRelease(claimId: string) {
    await apiFetch(`/api/claims/${claimId}/release`, { method: 'POST' });
    onRefresh();
    // Refresh claims for this item
    const res = await apiFetch<Claim[]>(
      `/api/shows/${showId}/claims?item_number=${item.itemNumber}`,
    );
    if ('data' in res) setClaimsData(res.data);
  }

  async function handleAward() {
    if (!awardHandle.trim()) return;
    setAwarding(true);
    await apiFetch(`/api/shows/${showId}/items/${item.id}/award`, {
      method: 'POST',
      body: JSON.stringify({ userHandle: awardHandle }),
    });
    setAwardHandle('');
    setAwarding(false);
    onRefresh();
    const res = await apiFetch<Claim[]>(
      `/api/shows/${showId}/claims?item_number=${item.itemNumber}`,
    );
    if ('data' in res) setClaimsData(res.data);
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold">
            #{item.itemNumber} &mdash; {item.title}
          </h3>
          <p className="text-sm text-gray-500">
            {item.claimedCount}/{item.totalQuantity} claimed
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Winners */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Winners ({winners.length})
          </h4>
          {winners.length === 0 ? (
            <p className="text-sm text-gray-400">No winners yet</p>
          ) : (
            <div className="space-y-2">
              {winners.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-green-50 p-2 rounded">
                  <div>
                    <span className="text-sm font-medium">@{c.userHandle || 'unknown'}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {new Date(c.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRelease(c.id)}>
                    Release
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waitlist */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Waitlist ({waitlist.length})
          </h4>
          {waitlist.length === 0 ? (
            <p className="text-sm text-gray-400">No one in waitlist</p>
          ) : (
            <div className="space-y-1">
              {waitlist.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded bg-blue-50">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      #{c.waitlistPosition}
                    </Badge>
                    <span className="text-sm">@{c.userHandle || 'unknown'}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRelease(c.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual Award */}
        {item.claimedCount < item.totalQuantity && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Manual Award</h4>
            <div className="flex gap-2">
              <Input
                value={awardHandle}
                onChange={(e) => setAwardHandle(e.target.value)}
                placeholder="@username"
                className="text-sm"
              />
              <Button size="sm" onClick={handleAward} disabled={awarding}>
                Award
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
