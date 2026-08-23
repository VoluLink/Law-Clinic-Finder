import type { Logger } from '@/lib/logger';

import type { TranscriptFacts } from './transcript-facts';
import type { ChatMessage } from './schema';

export type PersistDeps = {
  store: ConversationStore;
  readFacts: (transcript: ChatMessage[]) => Promise<TranscriptFacts>;
  logger: Logger;
};

export type ConversationRecord = PersistRunInfo & {
  sessionId: string | null;
  redactedTranscript: ChatMessage[] | null;
  redactionStatus: 'ok' | 'failed';
  detectedCity: string | null;
  messageCount: number;
};

export type ConversationStore = {
  record: (conversation: ConversationRecord) => Promise<void>;
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
  const outcome = await deps.readFacts(transcript);
  const redacted = outcome.status === 'ok' ? outcome : null;
  try {
    await deps.store.record({
      ...run,
      sessionId,
      redactedTranscript: redacted?.transcript ?? null,
      redactionStatus: outcome.status,
      detectedLegalArea: run.detectedLegalArea ?? redacted?.legalArea ?? null,
      detectedCity: redacted?.city ?? null,
      messageCount: transcript.length,
    });
  } catch (error) {
    deps.logger.error('conversation persist failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}
