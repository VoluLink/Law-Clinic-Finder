import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export type ChatSettings = {
  chat_model: string;
  chat_enabled: boolean;
  chat_max_tokens: number;
  chat_temperature: number;
  /** WHO the assistant is — composed into the system prompt as <role>. */
  chat_system_prompt: string;
  /** HOW it works a conversation — composed into the system prompt as <skill>. */
  chat_skill: string;
  /** Non-editable evidence boundary, loaded from the DB and composed as <grounding>. */
  chat_grounding_policy: string;
  /** Shown as a first assistant bubble; empty means no greeting. */
  chat_greeting: string;
  chat_max_recommendations: number;
};

/** Cost guard: a typo in the admin form must not multiply output spend. */
export const MAX_CHAT_MAX_TOKENS = 4096;

/** Hard ceiling on cards per reply. The admin setting may only lower this. */
export const MAX_CHAT_RECOMMENDATIONS = 8;

export const MAX_CHAT_GREETING_CHARS = 500;

/** The frozen baseline for the two prompt texts lives under these sibling keys;
 *  the admin panel's "reset to default" restores them. They are never written by
 *  the admin PUT (not part of chatSettingsUpdateSchema), so they stay immutable. */
const SYSTEM_PROMPT_DEFAULT_KEY = 'chat_system_prompt_default';
const SKILL_DEFAULT_KEY = 'chat_skill_default';

export type SettingRow = { key: string; value: unknown };

/**
 * Editable settings share one shape between the admin payload and runtime read.
 * The grounding policy extends only the runtime shape, so admin writes cannot
 * weaken the database evidence boundary.
 */
const editableChatSettingsShape = {
  chat_model: z.string().min(1).max(100),
  chat_enabled: z.boolean(),
  chat_max_tokens: z.number().int().positive().max(MAX_CHAT_MAX_TOKENS),
  chat_temperature: z.number().min(0).max(1),
  chat_system_prompt: z.string().min(1).max(20_000),
  chat_skill: z.string().min(1).max(20_000),
  chat_greeting: z.string().max(MAX_CHAT_GREETING_CHARS),
  chat_max_recommendations: z.number().int().min(1).max(MAX_CHAT_RECOMMENDATIONS),
} as const;

const chatSettingsShape = {
  ...editableChatSettingsShape,
  chat_grounding_policy: z.string().min(1).max(20_000),
} as const;

const CHAT_SETTINGS_KEYS = Object.keys(chatSettingsShape) as (keyof ChatSettings)[];

/** Admin settings editor payload. */
export const chatSettingsUpdateSchema = z.object(editableChatSettingsShape);

export type ChatSettingsResult =
  { ok: true; settings: ChatSettings } | { ok: false; missing: string[] };

/**
 * Validates the `settings` rows against every key strictly. There is no code
 * fallback: a missing or invalid key leaves the chat unconfigured (`ok: false`),
 * so a bad row degrades to the "unavailable" notice rather than sending a broken
 * prompt to the API. The seed migration guarantees all keys exist in practice.
 */
export function parseChatSettings(rows: SettingRow[]): ChatSettingsResult {
  const byKey = new Map(rows.map((row) => [row.key, row.value] as const));
  const settings: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const key of CHAT_SETTINGS_KEYS) {
    const parsed = chatSettingsShape[key].safeParse(byKey.get(key));
    if (parsed.success) settings[key] = parsed.data;
    else missing.push(key);
  }
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, settings: settings as ChatSettings };
}

/**
 * Reads the settings table. `anon` has no SELECT on it, so callers must pass a
 * service-role client — always from a server component or route.
 */
export async function loadChatSettings(client: SupabaseClient): Promise<ChatSettingsResult> {
  const { data } = await client.from('settings').select('key, value');
  return parseChatSettings(data ?? []);
}

export type AssistantFormView = {
  /** Present, valid values; a genuinely missing key is simply absent. */
  values: Partial<ChatSettings>;
  /** Baseline text the admin can revert Rolle/Ablauf to. */
  defaults: { chat_system_prompt: string; chat_skill: string };
  /** False when Rolle or Ablauf is absent — the bot cannot operate. */
  promptConfigured: boolean;
};

/**
 * Lenient projection for the admin editor: it must render whatever is stored,
 * even when incomplete, plus the revert baselines and whether the bot can run.
 */
export function readAssistantFormView(rows: SettingRow[]): AssistantFormView {
  const byKey = new Map(rows.map((row) => [row.key, row.value] as const));
  const values: Record<string, unknown> = {};
  for (const key of CHAT_SETTINGS_KEYS) {
    const parsed = chatSettingsShape[key].safeParse(byKey.get(key));
    if (parsed.success) values[key] = parsed.data;
  }
  const defaults = {
    chat_system_prompt: z.string().catch('').parse(byKey.get(SYSTEM_PROMPT_DEFAULT_KEY)),
    chat_skill: z.string().catch('').parse(byKey.get(SKILL_DEFAULT_KEY)),
  };
  const typed = values as Partial<ChatSettings>;
  const promptConfigured = Boolean(typed.chat_system_prompt) && Boolean(typed.chat_skill);
  return { values: typed, defaults, promptConfigured };
}
