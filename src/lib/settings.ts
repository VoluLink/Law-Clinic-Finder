import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { ASSISTANT_ROLE, CONSULTATION_SKILL } from './chat/prompts';

export type ChatSettings = {
  chat_model: string;
  chat_enabled: boolean;
  chat_max_tokens: number;
  chat_temperature: number;
  /** WHO the assistant is — composed into the system prompt as <role>. */
  chat_system_prompt: string;
  /** HOW it works a conversation — composed into the system prompt as <skill>. */
  chat_skill: string;
  /** Shown as a first assistant bubble; empty means no greeting. */
  chat_greeting: string;
  chat_max_recommendations: number;
};

/** Cost guard: a typo in the admin form must not multiply output spend. */
export const MAX_CHAT_MAX_TOKENS = 4096;

/** Hard ceiling on cards per reply. The admin setting may only lower this. */
export const MAX_CHAT_RECOMMENDATIONS = 8;

export const MAX_CHAT_GREETING_CHARS = 500;

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  chat_model: 'claude-haiku-4-5-20251001',
  chat_enabled: true,
  chat_max_tokens: 1024,
  // Lower than the API default of 1.0: clinic picks should be consistent
  // between two people describing the same problem.
  chat_temperature: 0.3,
  chat_system_prompt: ASSISTANT_ROLE,
  chat_skill: CONSULTATION_SKILL,
  chat_greeting: '',
  chat_max_recommendations: MAX_CHAT_RECOMMENDATIONS,
};

export type SettingRow = { key: string; value: unknown };

/**
 * Reads the settings table. `anon` has no SELECT on it, so callers must pass a
 * service-role client — always from a server component or route.
 */
export async function loadChatSettings(client: SupabaseClient): Promise<ChatSettings> {
  const { data } = await client.from('settings').select('key, value');
  return parseChatSettings(data ?? []);
}

const temperatureSchema = z.number().min(0).max(1);
const maxTokensSchema = z.number().int().positive().max(MAX_CHAT_MAX_TOKENS);
const recommendationsSchema = z.number().int().min(1).max(MAX_CHAT_RECOMMENDATIONS);
const greetingSchema = z.string().max(MAX_CHAT_GREETING_CHARS);

/** Admin settings editor payload — single source next to the defaults. */
export const chatSettingsUpdateSchema = z.object({
  chat_model: z.string().min(1).max(100),
  chat_enabled: z.boolean(),
  chat_max_tokens: maxTokensSchema,
  chat_temperature: temperatureSchema,
  chat_system_prompt: z.string().min(1).max(20_000),
  chat_skill: z.string().min(1).max(20_000),
  chat_greeting: greetingSchema,
  chat_max_recommendations: recommendationsSchema,
});

/**
 * Maps raw `settings` rows onto a typed, fully-populated ChatSettings object.
 * Missing or invalid values fall back to DEFAULT_CHAT_SETTINGS so a bad row can
 * never crash the chat route.
 */
export function parseChatSettings(rows: SettingRow[]): ChatSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value] as const));

  const pick = <T>(key: keyof ChatSettings, schema: z.ZodType<T>, fallback: T): T => {
    if (!byKey.has(key)) return fallback;
    const parsed = schema.safeParse(byKey.get(key));
    return parsed.success ? parsed.data : fallback;
  };

  const d = DEFAULT_CHAT_SETTINGS;
  return {
    chat_model: pick('chat_model', z.string().min(1), d.chat_model),
    chat_enabled: pick('chat_enabled', z.boolean(), d.chat_enabled),
    chat_max_tokens: pick('chat_max_tokens', maxTokensSchema, d.chat_max_tokens),
    chat_temperature: pick('chat_temperature', temperatureSchema, d.chat_temperature),
    chat_system_prompt: pick('chat_system_prompt', z.string().min(1), d.chat_system_prompt),
    chat_skill: pick('chat_skill', z.string().min(1), d.chat_skill),
    chat_greeting: pick('chat_greeting', greetingSchema, d.chat_greeting),
    chat_max_recommendations: pick(
      'chat_max_recommendations',
      recommendationsSchema,
      d.chat_max_recommendations,
    ),
  };
}
