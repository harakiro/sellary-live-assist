'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your workspace</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workspace Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Settings will be available here. Configure claim words, pass words, and other preferences.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
