import type { SupabaseClient } from '@supabase/supabase-js';

import type { Logger } from '@/lib/logger';

import type { RedactionOutcome } from './redact';
import type { ChatMessage } from './schema';

export type PersistDeps = {
  adminClient: SupabaseClient;
  redact: (transcript: ChatMessage[]) => Promise<RedactionOutcome>;
  logger: Logger;
};

export type PersistRunInfo = { matchedClinicCount: number | null; model: string };

export async function persistConversation(
  deps: PersistDeps,
  transcript: ChatMessage[],
  run: PersistRunInfo,
): Promise<void> {
  const outcome = await deps.redact(transcript);
  const redacted = outcome.status === 'ok' ? outcome : null;
  const { error } = await deps.adminClient.from('conversations').insert({
    redacted_transcript: redacted?.transcript ?? null,
    redaction_status: outcome.status,
    detected_legal_area: redacted?.legalArea ?? null,
    detected_city: redacted?.city ?? null,
    matched_clinic_count: run.matchedClinicCount,
    message_count: transcript.length,
    model: run.model,
  });
  if (error) deps.logger.error('conversation insert failed', { reason: error.message });
}
