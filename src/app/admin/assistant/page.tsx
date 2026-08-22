import type { Metadata } from 'next';

import { firebaseSettingsRepository } from '@/lib/firebase/settings-repository';
import { readAssistantFormView } from '@/lib/settings';

import { AssistantForm } from './AssistantForm';

export const metadata: Metadata = { title: 'KI-Assistent – Admin' };

export default async function AdminAssistantPage() {
  const view = readAssistantFormView(await firebaseSettingsRepository.list());
  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">KI-Assistent</h1>
      <AssistantForm initial={view.values} defaults={view.defaults} />
    </>
  );
}
