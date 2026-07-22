import type { Metadata } from 'next';

import { parseChatSettings } from '@/lib/settings';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AssistantForm } from './AssistantForm';

export const metadata: Metadata = { title: 'KI-Assistent – Admin' };

export default async function AdminAssistantPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('settings').select('key, value');
  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">KI-Assistent</h1>
      <AssistantForm settings={parseChatSettings(data ?? [])} />
    </>
  );
}
