'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Tv, Link2, Plus } from 'lucide-react';

export default function DashboardPage() {
  const { workspace } = useAuth();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {workspace?.name ?? 'Dashboard'}
        </h1>
        <p className="text-gray-500 mt-1">Manage your live sales</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tv className="h-5 w-5" />
              Shows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Create and manage your live sale shows
            </p>
            <Link href="/shows">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Show
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-5 w-5" />
              Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Connect your Facebook and Instagram accounts
            </p>
            <Link href="/connections">
              <Button size="sm" variant="outline">
                Manage Connections
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
