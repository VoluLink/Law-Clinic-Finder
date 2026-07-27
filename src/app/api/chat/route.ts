import Anthropic from '@anthropic-ai/sdk';
import { after, type NextRequest } from 'next/server';

import { listDirectoryTerms } from '@/lib/chat/directory-terms';
import { handleChatRequest, type ChatHandlerDeps } from '@/lib/chat/handle-chat';
import { persistConversation } from '@/lib/chat/persist-conversation';
import { redactTranscript } from '@/lib/chat/redact';
import { recommendClinics } from '@/lib/chat/recommend-clinics';
import { runChat } from '@/lib/chat/run-chat';
import { searchClinics } from '@/lib/chat/search-clinics';
import { logger } from '@/lib/logger';
import {
  CHAT_DAILY_RATE_LIMIT,
  CHAT_RATE_LIMIT,
  combineRateLimiters,
  createRateLimiter,
} from '@/lib/rate-limit';
import { loadChatSettings } from '@/lib/settings';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const limiter = combineRateLimiters(
  { scope: 'minute', limiter: createRateLimiter(CHAT_RATE_LIMIT) },
  { scope: 'day', limiter: createRateLimiter(CHAT_DAILY_RATE_LIMIT) },
);

export async function POST(request: NextRequest): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SECRET_KEY) {
    logger.error('chat route missing ANTHROPIC_API_KEY or SUPABASE_SECRET_KEY');
    return Response.json({ error: 'Der Chat ist derzeit nicht konfiguriert.' }, { status: 503 });
  }
  return handleChatRequest(request, buildDeps());
}

function buildDeps(): ChatHandlerDeps {
  const anthropic = new Anthropic();
  const adminClient = createSupabaseAdminClient();
  return {
    limiter,
    logger,
    loadSettings: () => loadChatSettings(adminClient),
    run: (settings, messages) => {
      // Service-role remains server-only: search_clinics filters published rows
      // and never exposes contact_email to the model; recommendation cards load
      // a selected clinic's address only after the ID lookup succeeds.
      const executeSearchClinics = (input: unknown) => searchClinics(adminClient, input ?? {});
      const executeRecommendClinics = (input: unknown) =>
        recommendClinics(adminClient, input ?? {}, settings.chat_max_recommendations);
      const executeListDirectoryTerms = () => listDirectoryTerms(adminClient);
      return runChat(
        { anthropic, executeSearchClinics, executeRecommendClinics, executeListDirectoryTerms },
        settings,
        messages,
      );
    },
    persist: (transcript, run, sessionId) =>
      persistConversation(
        { adminClient, redact: redactTranscript, logger },
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
      ),
    schedule: (task) => after(task),
  };
}
