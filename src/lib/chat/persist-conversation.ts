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
  detectedLegalArea: string | null;
  recommendedClinicIds: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Upserts one row per entire chat. Every turn re-sends the full transcript under
 * the same `sessionId`, so `record_conversation` accumulates the tokens and
 * de-duplicates recommendation events server-side. A null `sessionId` (legacy
 * client) simply inserts a fresh row, as before.
 */
export async function persistConversation(
  deps: PersistDeps,
  transcript: ChatMessage[],
  run: PersistRunInfo,
  sessionId: string | null,
): Promise<void> {
  const outcome = await deps.redact(transcript);
  const redacted = outcome.status === 'ok' ? outcome : null;
  const { error } = await deps.adminClient.rpc('record_conversation', {
    p_session_id: sessionId,
    p_redacted_transcript: redacted?.transcript ?? null,
    p_redaction_status: outcome.status,
    p_detected_legal_area: run.detectedLegalArea ?? redacted?.legalArea ?? null,
    p_detected_city: redacted?.city ?? null,
    p_matched_clinic_count: run.matchedClinicCount,
    p_message_count: transcript.length,
    p_model: run.model,
    p_input_tokens: run.inputTokens,
    p_output_tokens: run.outputTokens,
    p_recommended_clinic_ids: run.recommendedClinicIds,
  });
  if (error) deps.logger.error('conversation persist failed', { reason: error.message });
}
