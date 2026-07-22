import type { SupabaseClient } from '@supabase/supabase-js';

import type { Logger } from '@/lib/logger';

import type { RedactionOutcome } from './redact';
import type { ChatMessage } from './schema';

export type PersistDeps = {
  adminClient: SupabaseClient;
  redact: (transcript: ChatMessage[]) => Promise<RedactionOutcome>;
  logger: Logger;
};

export type PersistRunInfo = {
  matchedClinicCount: number | null;
  recommendedClinicIds: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export async function persistConversation(
  deps: PersistDeps,
  transcript: ChatMessage[],
  run: PersistRunInfo,
): Promise<void> {
  const outcome = await deps.redact(transcript);
  const redacted = outcome.status === 'ok' ? outcome : null;
  const { data, error } = await deps.adminClient
    .from('conversations')
    .insert({
      redacted_transcript: redacted?.transcript ?? null,
      redaction_status: outcome.status,
      detected_legal_area: redacted?.legalArea ?? null,
      detected_city: redacted?.city ?? null,
      matched_clinic_count: run.matchedClinicCount,
      message_count: transcript.length,
      model: run.model,
      input_tokens: run.inputTokens,
      output_tokens: run.outputTokens,
    })
    .select('id')
    .single();
  if (error) {
    deps.logger.error('conversation insert failed', { reason: error.message });
    return;
  }
  await recordRecommendationEvents(deps, data.id, run.recommendedClinicIds);
}

/**
 * One 'recommended' event per clinic shown, feeding the member stats tab.
 * Best-effort: a failure here must not lose the conversation, so it logs at
 * warn and returns.
 */
async function recordRecommendationEvents(
  deps: PersistDeps,
  conversationId: string,
  clinicIds: string[],
): Promise<void> {
  if (clinicIds.length === 0) return;
  const { error } = await deps.adminClient.from('clinic_events').insert(
    clinicIds.map((clinicId) => ({
      clinic_id: clinicId,
      kind: 'recommended',
      conversation_id: conversationId,
    })),
  );
  if (error) deps.logger.warn('recommendation events insert failed', { reason: error.message });
}
