import type { Metadata } from 'next';

import { Card } from '@/components/ui/Card';
import { parseChatSettings } from '@/lib/settings';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { SettingsForm } from './SettingsForm';

export const metadata: Metadata = { title: 'Einstellungen – Admin' };

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('settings').select('key, value');
  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Chat-Einstellungen</h1>
      <Card className="p-6">
        <SettingsForm settings={parseChatSettings(data ?? [])} />
      </Card>
    </>
  );
}
