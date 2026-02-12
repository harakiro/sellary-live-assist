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
  autoReplyEnabled?: boolean;
  replyTemplatesWinner?: string[];
  replyTemplatesDuplicate?: string[];
  replyTemplatesWaitlist?: string[];
};

const DEFAULT_WINNER_TEMPLATE = 'Reserved! {{user}}, please DM us for your checkout link!';
const DEFAULT_DUPLICATE_TEMPLATE = "You're all set {{user}}! We already have your reservation for item #{{item}}.";
const DEFAULT_WAITLIST_TEMPLATE = "{{user}}, item #{{item}} is currently claimed. You're on the waitlist — we'll let you know if it opens up!";

export default function SettingsPage() {
  const { workspace } = useAuth();
  const [name, setName] = useState('');
  const [claimWord, setClaimWord] = useState('sold');
  const [passWord, setPassWord] = useState('pass');
  const [pollingInterval, setPollingInterval] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auto-reply state
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [winnerTemplates, setWinnerTemplates] = useState<string[]>([DEFAULT_WINNER_TEMPLATE]);
  const [duplicateTemplates, setDuplicateTemplates] = useState<string[]>([DEFAULT_DUPLICATE_TEMPLATE]);
  const [waitlistTemplates, setWaitlistTemplates] = useState<string[]>([DEFAULT_WAITLIST_TEMPLATE]);
  const [savingReply, setSavingReply] = useState(false);
  const [savedReply, setSavedReply] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'winner' | 'duplicate' | 'waitlist' | null>('winner');

  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name);
    const settings = workspace.settings as WorkspaceSettings | null;
    if (settings) {
      setClaimWord(settings.defaultClaimWord || 'sold');
      setPassWord(settings.defaultPassWord || 'pass');
      setPollingInterval(settings.defaultPollingInterval || 2);
      setAutoReplyEnabled(settings.autoReplyEnabled ?? false);
      if (settings.replyTemplatesWinner?.length) setWinnerTemplates(settings.replyTemplatesWinner);
      if (settings.replyTemplatesDuplicate?.length) setDuplicateTemplates(settings.replyTemplatesDuplicate);
      if (settings.replyTemplatesWaitlist?.length) setWaitlistTemplates(settings.replyTemplatesWaitlist);
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

  async function handleSaveAutoReply(e: FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    setSavingReply(true);
    setSavedReply(false);

    await apiFetch(`/api/workspaces/${workspace.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        settings: {
          autoReplyEnabled,
          replyTemplatesWinner: winnerTemplates.filter((t) => t.trim()),
          replyTemplatesDuplicate: duplicateTemplates.filter((t) => t.trim()),
          replyTemplatesWaitlist: waitlistTemplates.filter((t) => t.trim()),
        },
      }),
    });

    setSavingReply(false);
    setSavedReply(true);
    setTimeout(() => setSavedReply(false), 3000);
  }

  function updateTemplate(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) {
    setter((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function addTemplate(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    templates: string[],
  ) {
    if (templates.length >= 10) return;
    setter((prev) => [...prev, '']);
  }

  function removeTemplate(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    templates: string[],
  ) {
    if (templates.length <= 1) return;
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  function renderTemplateSection(
    label: string,
    sectionKey: 'winner' | 'duplicate' | 'waitlist',
    templates: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) {
    const isExpanded = expandedSection === sectionKey;

    return (
      <div className="border border-gray-200 rounded-md">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setExpandedSection(isExpanded ? null : sectionKey)}
        >
          <span>{label} ({templates.length} template{templates.length !== 1 ? 's' : ''})</span>
          <span className="text-gray-400">{isExpanded ? '\u25B2' : '\u25BC'}</span>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3">
            {templates.map((tmpl, i) => (
              <div key={i} className="flex gap-2">
                <textarea
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-brand-500 resize-y min-h-[60px]"
                  value={tmpl}
                  onChange={(e) => updateTemplate(setter, i, e.target.value)}
                  maxLength={500}
                  placeholder="Enter reply template..."
                />
                {templates.length > 1 && (
                  <button
                    type="button"
                    className="self-start px-2 py-2 text-sm text-red-500 hover:text-red-700"
                    onClick={() => removeTemplate(setter, i, templates)}
                    title="Remove template"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            {templates.length < 10 && (
              <button
                type="button"
                className="text-sm text-brand-600 hover:text-brand-700"
                onClick={() => addTemplate(setter, templates)}
              >
                + Add variation
              </button>
            )}
          </div>
        )}
      </div>
    );
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Auto-Reply</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveAutoReply} className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={autoReplyEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoReplyEnabled ? 'bg-brand-600' : 'bg-gray-300'
                }`}
                onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoReplyEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                {autoReplyEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              When enabled, the system will automatically reply to claim comments on your Facebook Live
              as the Page. Use <code className="bg-gray-100 px-1 rounded">{'{{user}}'}</code> for the
              commenter&apos;s name and <code className="bg-gray-100 px-1 rounded">{'{{item}}'}</code> for the item number.
              Multiple templates per case will be randomly selected.
            </p>

            <div className="space-y-2">
              {renderTemplateSection('Winner', 'winner', winnerTemplates, setWinnerTemplates)}
              {renderTemplateSection('Duplicate Claim', 'duplicate', duplicateTemplates, setDuplicateTemplates)}
              {renderTemplateSection('Waitlist', 'waitlist', waitlistTemplates, setWaitlistTemplates)}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={savingReply}>
                {savingReply ? 'Saving...' : 'Save Auto-Reply Settings'}
              </Button>
              {savedReply && <span className="text-sm text-green-600">Saved!</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
