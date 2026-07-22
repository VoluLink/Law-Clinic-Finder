import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type { ChatSettings } from '@/lib/settings';

import {
  buildSystemPrompt,
  RECOMMEND_CLINICS_DESCRIPTION,
  REPORT_NO_MATCH_DESCRIPTION,
  SEARCH_CLINICS_DESCRIPTION,
} from './prompts';
import { recommendClinicsInputSchema } from './recommend-clinics';
import type { ChatMessage } from './schema';
import { searchClinicsInputSchema } from './search-clinics';
import { encodeChatEvent, type ChatEvent, type ClinicRecommendation } from './stream-protocol';

const MAX_TOOL_TURNS = 5;

type StreamEvent = { type: string; delta?: unknown };

const textDeltaSchema = z.object({ type: z.literal('text_delta'), text: z.string() });
const usageSchema = z.object({ input_tokens: z.number(), output_tokens: z.number() });
type FinalMessage = { content: unknown[]; stop_reason: string | null; usage?: unknown };
type StreamParams = {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
};

export type MessageStreamLike = AsyncIterable<StreamEvent> & {
  finalMessage(): Promise<FinalMessage>;
};

export type AnthropicLike = {
  messages: {
    stream(params: StreamParams): MessageStreamLike;
  };
};

export type RunChatDeps = {
  anthropic: AnthropicLike;
  executeSearchClinics: (input: unknown) => Promise<string>;
  executeRecommendClinics: (
    input: unknown,
  ) => Promise<{ json: string; recommendations: ClinicRecommendation[] }>;
};

export type ChatRunResult = {
  assistantText: string;
  matchedClinicCount: number | null;
  toolCallCount: number;
  recommendations: ClinicRecommendation[];
  /** Distinct directory ids recommended across the whole run — for stats. */
  recommendedClinicIds: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type ChatRun = { stream: ReadableStream<Uint8Array>; result: Promise<ChatRunResult> };

export const SEARCH_CLINICS_TOOL: Anthropic.Tool = {
  name: 'search_clinics',
  description: SEARCH_CLINICS_DESCRIPTION,
  // z.toJSONSchema emits a draft-2020-12 object schema; the SDK type just
  // wants its literal 'object' discriminant.
  input_schema: z.toJSONSchema(searchClinicsInputSchema) as Anthropic.Tool['input_schema'],
};

export const RECOMMEND_CLINICS_TOOL: Anthropic.Tool = {
  name: 'recommend_clinics',
  description: RECOMMEND_CLINICS_DESCRIPTION,
  input_schema: z.toJSONSchema(recommendClinicsInputSchema) as Anthropic.Tool['input_schema'],
};

// No parameters: the model's mere invocation is the signal, and the card's copy
// is app-owned, so there is nothing for the model to fill in.
export const REPORT_NO_MATCH_TOOL: Anthropic.Tool = {
  name: 'report_no_match',
  description: REPORT_NO_MATCH_DESCRIPTION,
  input_schema: z.toJSONSchema(z.object({})) as Anthropic.Tool['input_schema'],
};

const toolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});

type RunState = {
  text: string;
  toolCalls: number;
  matched: number | null;
  recommendations: ClinicRecommendation[];
  /** Every distinct clinic id recommended, kept across multiple tool calls. */
  recommendedIds: Set<string>;
  inputTokens: number;
  outputTokens: number;
};

/** Sums token usage across every turn's final message (mocks may omit it). */
function addUsage(state: RunState, final: FinalMessage): void {
  const usage = usageSchema.safeParse(final.usage);
  if (!usage.success) return;
  state.inputTokens += usage.data.input_tokens;
  state.outputTokens += usage.data.output_tokens;
}

export function runChat(
  deps: RunChatDeps,
  settings: ChatSettings,
  messages: ChatMessage[],
): ChatRun {
  const encoder = new TextEncoder();
  let settle!: { resolve: (r: ChatRunResult) => void; reject: (e: unknown) => void };
  const result = new Promise<ChatRunResult>((resolve, reject) => {
    settle = { resolve, reject };
  });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const emit = (event: ChatEvent) =>
          controller.enqueue(encoder.encode(encodeChatEvent(event)));
        settle.resolve(await driveConversation(deps, settings, messages, emit));
        controller.close();
      } catch (error) {
        settle.reject(error);
        controller.error(error);
      }
    },
  });
  return { stream, result };
}

async function driveConversation(
  deps: RunChatDeps,
  settings: ChatSettings,
  messages: ChatMessage[],
  emit: (event: ChatEvent) => void,
): Promise<ChatRunResult> {
  const history: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const state: RunState = {
    text: '',
    toolCalls: 0,
    matched: null,
    recommendations: [],
    recommendedIds: new Set(),
    inputTokens: 0,
    outputTokens: 0,
  };
  for (let turn = 0; turn <= MAX_TOOL_TURNS; turn++) {
    const final = await streamTurn(deps, settings, history, (t) => {
      state.text += t;
      emit({ t: 'text', v: t });
    });
    addUsage(state, final);
    const toolUses = collectToolUses(final);
    if (final.stop_reason !== 'tool_use' || toolUses.length === 0) break;
    // Response content blocks are valid request params (SDK-documented pattern).
    history.push({ role: 'assistant', content: final.content as Anthropic.ContentBlockParam[] });
    history.push({ role: 'user', content: await runTools(deps, toolUses, state, emit) });
  }
  return {
    assistantText: state.text,
    matchedClinicCount: state.matched,
    toolCallCount: state.toolCalls,
    recommendations: state.recommendations,
    recommendedClinicIds: [...state.recommendedIds],
    model: settings.chat_model,
    inputTokens: state.inputTokens,
    outputTokens: state.outputTokens,
  };
}

async function streamTurn(
  deps: RunChatDeps,
  settings: ChatSettings,
  history: Anthropic.MessageParam[],
  onText: (text: string) => void,
): Promise<FinalMessage> {
  const stream = deps.anthropic.messages.stream({
    model: settings.chat_model,
    max_tokens: settings.chat_max_tokens,
    temperature: settings.chat_temperature,
    system: buildSystemPrompt(settings.chat_system_prompt, settings.chat_skill),
    messages: history,
    tools: [SEARCH_CLINICS_TOOL, RECOMMEND_CLINICS_TOOL, REPORT_NO_MATCH_TOOL],
  });
  for await (const event of stream) {
    if (event.type !== 'content_block_delta') continue;
    const delta = textDeltaSchema.safeParse(event.delta);
    if (delta.success) onText(delta.data.text);
  }
  return stream.finalMessage();
}

function collectToolUses(final: FinalMessage): Array<z.infer<typeof toolUseBlockSchema>> {
  return final.content.flatMap((block) => {
    const parsed = toolUseBlockSchema.safeParse(block);
    return parsed.success ? [parsed.data] : [];
  });
}

async function runTools(
  deps: RunChatDeps,
  toolUses: Array<z.infer<typeof toolUseBlockSchema>>,
  state: RunState,
  emit: (event: ChatEvent) => void,
): Promise<Anthropic.ToolResultBlockParam[]> {
  return Promise.all(toolUses.map((block) => runTool(deps, block, state, emit)));
}

async function runTool(
  deps: RunChatDeps,
  block: z.infer<typeof toolUseBlockSchema>,
  state: RunState,
  emit: (event: ChatEvent) => void,
): Promise<Anthropic.ToolResultBlockParam> {
  state.toolCalls += 1;
  try {
    const content =
      block.name === RECOMMEND_CLINICS_TOOL.name
        ? await runRecommend(deps, block.input, state, emit)
        : block.name === REPORT_NO_MATCH_TOOL.name
          ? runNoMatch(emit)
          : await runSearch(deps, block.input, state);
    return { type: 'tool_result', tool_use_id: block.id, content };
  } catch {
    // Reported to the model as a failed tool call; it apologises to the user.
    return {
      type: 'tool_result',
      tool_use_id: block.id,
      content: 'Die Suche ist fehlgeschlagen.',
      is_error: true,
    };
  }
}

/** Signals the "no clinic fits" card to the UI; its copy is app-owned, so the
 *  frame carries no payload and the model gets a plain acknowledgement back. */
function runNoMatch(emit: (event: ChatEvent) => void): string {
  emit({ t: 'nomatch' });
  return JSON.stringify({ displayed: true });
}

async function runSearch(deps: RunChatDeps, input: unknown, state: RunState): Promise<string> {
  const json = await deps.executeSearchClinics(input);
  state.matched = extractMatchedCount(json) ?? state.matched;
  return json;
}

/** Emits the cards mid-stream, so they appear with the reply rather than after it. */
async function runRecommend(
  deps: RunChatDeps,
  input: unknown,
  state: RunState,
  emit: (event: ChatEvent) => void,
): Promise<string> {
  const { json, recommendations } = await deps.executeRecommendClinics(input);
  if (recommendations.length > 0) {
    state.recommendations = recommendations;
    for (const card of recommendations) state.recommendedIds.add(card.id);
    emit({ t: 'clinics', v: recommendations });
  }
  return json;
}

function extractMatchedCount(json: string): number | null {
  try {
    const parsed = z.object({ count: z.number() }).safeParse(JSON.parse(json));
    return parsed.success ? parsed.data.count : null;
  } catch {
    // Tool output was not JSON; count is simply unknown.
    return null;
  }
}
