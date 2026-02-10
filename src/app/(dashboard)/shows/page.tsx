'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function ShowsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shows</h1>
          <p className="text-gray-500 mt-1">Manage your live sale sessions</p>
        </div>
        <Link href="/shows/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            New Show
          </Button>
        </Link>
      </div>

      <div className="text-center py-12 text-gray-500">
        <p>No shows yet. Create your first show to get started.</p>
      </div>
    </div>
  );
}
