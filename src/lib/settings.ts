import { z } from 'zod';

export type ChatSettings = {
  chat_model: string;
  chat_enabled: boolean;
  chat_max_tokens: number;
  chat_system_prompt: string;
};

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  chat_model: 'claude-haiku-4-5-20251001',
  chat_enabled: true,
  chat_max_tokens: 1024,
  chat_system_prompt:
    'Du bist der Assistent des Law Clinic Finder von Law Clinics Deutschland. Deine einzige ' +
    'Aufgabe: Hilfesuchenden die passende studentische Rechtsberatung (Law Clinic) vermitteln. ' +
    'Erfrage, falls nicht genannt: (1) Wohnort, (2) wer die Person ist (z. B. Studierende:r, ' +
    'geflüchtete Person, Gründer:in), (3) worum es rechtlich geht. Bestimme daraus das ' +
    'Rechtsgebiet und suche mit dem search_clinics-Tool (Stadtfilter findet auch bundesweite ' +
    'Clinics; ohne Filter bekommst du das ganze Verzeichnis und kannst selbst darin suchen). ' +
    'Bei Unklarheit stelle EINE gezielte Rückfrage. Zeige die passenden Clinics dann IMMER ' +
    'mit dem recommend_clinics-Tool an, beste zuerst, mit je einem kurzen Satz, warum diese ' +
    'Clinic zur Schilderung passt. Die Website zeigt daraus Karten mit Name, Ort, ' +
    'Rechtsgebieten und Kontakt-Buttons — zähle die Clinics daher nicht zusätzlich im Text ' +
    'auf, sondern halte deine Nachricht davor kurz. Verwende exakt die Namen aus den ' +
    'Tool-Ergebnissen — erfinde keine. Wichtig: Du gibst ' +
    'KEINE Rechtsberatung, keine Einschätzung der Erfolgsaussichten und keine juristischen ' +
    'Tipps; verweise dafür stets an die Law Clinics. Antworte auf Deutsch, außer die Person ' +
    'schreibt in einer anderen Sprache.',
};

export type SettingRow = { key: string; value: unknown };

/** Cost guard: a typo in the admin settings form must not multiply output spend. */
export const MAX_CHAT_MAX_TOKENS = 4096;

/** Admin settings editor payload — single source next to the defaults. */
export const chatSettingsUpdateSchema = z.object({
  chat_model: z.string().min(1).max(100),
  chat_enabled: z.boolean(),
  chat_max_tokens: z.number().int().positive().max(MAX_CHAT_MAX_TOKENS),
  chat_system_prompt: z.string().min(1).max(20_000),
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

  return {
    chat_model: pick('chat_model', z.string().min(1), DEFAULT_CHAT_SETTINGS.chat_model),
    chat_enabled: pick('chat_enabled', z.boolean(), DEFAULT_CHAT_SETTINGS.chat_enabled),
    chat_max_tokens: pick(
      'chat_max_tokens',
      z.number().int().positive().max(MAX_CHAT_MAX_TOKENS),
      DEFAULT_CHAT_SETTINGS.chat_max_tokens,
    ),
    chat_system_prompt: pick(
      'chat_system_prompt',
      z.string().min(1),
      DEFAULT_CHAT_SETTINGS.chat_system_prompt,
    ),
  };
}
