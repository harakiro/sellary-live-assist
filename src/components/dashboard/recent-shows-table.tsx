'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatRelativeDate, formatCents } from '@/lib/utils';

type RecentShow = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  itemsSold: number;
  revenueCollectedCents: number;
  cartsPending: number;
};

type RecentShowsTableProps = {
  shows: RecentShow[];
};

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'active': return 'success' as const;
    case 'paused': return 'warning' as const;
    case 'ended': return 'secondary' as const;
    default: return 'outline' as const;
  }
};

export function RecentShowsTable({ shows }: RecentShowsTableProps) {
  if (shows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No shows yet. Create your first show to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Show</th>
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Items Sold</th>
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Revenue</th>
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Carts Pending</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shows.map((show) => (
              <tr key={show.id} className="hover:bg-gray-50">
                <td className="py-3">
                  <Link href={`/shows/${show.id}`} className="text-sm font-medium text-gray-900 hover:text-brand-600">
                    {show.name}
                  </Link>
                </td>
                <td className="py-3 text-sm text-gray-500">
                  {formatRelativeDate(show.startedAt || show.createdAt)}
                </td>
                <td className="py-3">
                  <Badge variant={statusBadgeVariant(show.status)}>{show.status}</Badge>
                </td>
                <td className="py-3 text-sm text-gray-900 text-right">{show.itemsSold}</td>
                <td className="py-3 text-sm text-gray-900 text-right">
                  {formatCents(show.revenueCollectedCents)}
                </td>
                <td className="py-3 text-sm text-gray-900 text-right">{show.cartsPending}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-center">
        <Link href="/shows" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
          View All Shows
        </Link>
      </div>
    </div>
  );
}
