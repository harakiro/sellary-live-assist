'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Radio } from 'lucide-react';

type ActiveShowBannerProps = {
  show: { id: string; name: string };
};

export function ActiveShowBanner({ show }: ActiveShowBannerProps) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
        <div>
          <span className="text-sm font-semibold text-green-800">LIVE NOW</span>
          <span className="text-sm text-green-700 ml-2">{show.name}</span>
        </div>
      </div>
      <Link href={`/shows/${show.id}/console`}>
        <Button size="sm" className="bg-green-600 hover:bg-green-700">
          <Radio className="h-3.5 w-3.5 mr-1.5" />
          Go to Console
        </Button>
      </Link>
    </div>
  );
}
