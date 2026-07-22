import type { Metadata } from 'next';

import { readAssistantFormView } from '@/lib/settings';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AssistantForm } from './AssistantForm';

export const metadata: Metadata = { title: 'KI-Assistent – Admin' };

export default async function AdminAssistantPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('settings').select('key, value');
  const view = readAssistantFormView(data ?? []);
  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">KI-Assistent</h1>
      <AssistantForm initial={view.values} defaults={view.defaults} />
    </>
  );
}
