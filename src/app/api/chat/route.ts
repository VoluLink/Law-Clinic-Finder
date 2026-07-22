import Anthropic from '@anthropic-ai/sdk';
import { after, type NextRequest } from 'next/server';

import { listDirectoryTerms } from '@/lib/chat/directory-terms';
import { handleChatRequest, type ChatHandlerDeps } from '@/lib/chat/handle-chat';
import { persistConversation } from '@/lib/chat/persist-conversation';
import { createRedactionModel, redactTranscript } from '@/lib/chat/redact';
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
  const redactionModel = createRedactionModel(anthropic);
  return {
    limiter,
    logger,
    loadSettings: () => loadChatSettings(adminClient),
    run: (settings, messages) => {
      // Service-role, because `anon` no longer holds SELECT on contact_email
      // (20260720120000_lockdown_grants) and the assistant needs to be able to
      // give that address out. RLS is therefore bypassed here: the
      // `is_published` filter inside searchClinics is the only row guard, and
      // it is covered by a regression test.
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
    persist: (transcript, run) =>
      persistConversation(
        { adminClient, redact: (t) => redactTranscript(redactionModel, t), logger },
        transcript,
        {
          matchedClinicCount: run.matchedClinicCount,
          recommendedClinicIds: run.recommendedClinicIds,
          model: run.model,
          inputTokens: run.inputTokens,
          outputTokens: run.outputTokens,
        },
      ),
    schedule: (task) => after(task),
  };
}
