import Anthropic from '@anthropic-ai/sdk';
import { after, type NextRequest } from 'next/server';

import { listDirectoryTerms } from '@/lib/chat/directory-terms';
import { claimDailyChatQuota } from '@/lib/chat/daily-quota';
import { handleChatRequest, type ChatHandlerDeps } from '@/lib/chat/handle-chat';
import { persistConversation } from '@/lib/chat/persist-conversation';
import { readTranscriptFacts } from '@/lib/chat/transcript-facts';
import { recommendClinics } from '@/lib/chat/recommend-clinics';
import { runChat } from '@/lib/chat/run-chat';
import { searchClinics } from '@/lib/chat/search-clinics';
import { firebaseClinicDirectory } from '@/lib/firebase/clinic-directory';
import { firebaseConversationStore } from '@/lib/firebase/conversation-store';
import { firebaseDailyQuotaStore } from '@/lib/firebase/daily-quota-store';
import { firebaseSettingsRepository } from '@/lib/firebase/settings-repository';
import { requestLogger } from '@/lib/http/request-id';
import type { Logger } from '@/lib/logger';
import { CHAT_RATE_LIMIT, combineRateLimiters, createRateLimiter } from '@/lib/rate-limit';
import { loadChatSettings } from '@/lib/settings';

const limiter = combineRateLimiters({
  scope: 'minute',
  limiter: createRateLimiter(CHAT_RATE_LIMIT),
});

export async function POST(request: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.error('chat route missing ANTHROPIC_API_KEY');
    return Response.json({ error: 'Der Chat ist derzeit nicht konfiguriert.' }, { status: 503 });
  }
  return handleChatRequest(request, buildDeps(logger));
}

function buildDeps(logger: Logger): ChatHandlerDeps {
  const anthropic = new Anthropic();
  return {
    limiter,
    claimQuota: (request, sessionId) =>
      claimDailyChatQuota({ store: firebaseDailyQuotaStore }, request, sessionId),
    logger,
    loadSettings: () => loadChatSettings(firebaseSettingsRepository),
    run: buildRunner(anthropic),
    persist: buildPersister(logger),
    schedule: (task) => after(task),
  };
}

function buildRunner(anthropic: Anthropic): ChatHandlerDeps['run'] {
  return (settings, messages) =>
    runChat(
      {
        anthropic,
        executeSearchClinics: (input) => searchClinics(firebaseClinicDirectory, input ?? {}),
        executeRecommendClinics: (input) =>
          recommendClinics(firebaseClinicDirectory, input ?? {}, settings.chat_max_recommendations),
        executeListDirectoryTerms: () => listDirectoryTerms(firebaseClinicDirectory),
      },
      settings,
      messages,
    );
}

function buildPersister(logger: Logger): ChatHandlerDeps['persist'] {
  return (transcript, run, sessionId) =>
    persistConversation(
      { store: firebaseConversationStore, readFacts: readTranscriptFacts, logger },
      transcript,
      {
        matchedClinicCount: run.matchedClinicCount,
        detectedLegalArea: run.detectedLegalArea,
        recommendedClinicIds: run.recommendedClinicIds,
        model: run.model,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
      },
      sessionId,
    );
}
