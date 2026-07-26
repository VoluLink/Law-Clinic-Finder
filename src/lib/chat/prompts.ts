/**
 * Model-facing text that stays in code because it is coupled to the tool schemas
 * and is never edited by admins: the four tool descriptions below.
 *
 * The assistant's role and procedure (Rolle/Ablauf) do NOT live here. They live
 * only in the `settings` table (`chat_system_prompt` / `chat_skill`), seeded by a
 * migration and edited by admins at /admin/assistant. The chat route reads them on
 * every request; if either is missing the chat is shown as unavailable rather than
 * falling back to code. To change them from the code side, ship a migration that
 * upserts those settings rows — there is no code copy to edit.
 */

export function buildSystemPrompt(role: string, skill: string): string {
  return `<role>\n${role}\n</role>\n\n<skill name="clinic-consultation">\n${skill}\n</skill>`;
}

/** The tool identifiers the assistant drives. Single source for the tool
 *  definitions (run-chat) and the admin toolbox reference below. */
export const TOOL_NAMES = {
  listDirectoryTerms: 'list_directory_terms',
  searchClinics: 'search_clinics',
  recommendClinics: 'recommend_clinics',
  reportNoMatch: 'report_no_match',
} as const;

/**
 * Read-only reference rendered in the admin assistant editor: an admin who edits
 * the Ablauf can see which tool names exist and what each does, so they reuse the
 * exact names. Not admin-editable and not stored in the database.
 */
export const PROMPT_TOOLBOX: { name: string; description: string }[] = [
  {
    name: TOOL_NAMES.listDirectoryTerms,
    description:
      'Liest aus, welche Rechtsgebiete, Regionen, Sprachen und Zielgruppen im Verzeichnis tatsächlich vorkommen. Der Assistent ruft es einmal pro Gespräch auf und wählt daraus gültige Suchbegriffe.',
  },
  {
    name: TOOL_NAMES.searchClinics,
    description:
      'Durchsucht das Verzeichnis der veröffentlichten Law Clinics nach Ort, Rechtsgebiet, Sprache und Zielgruppe. Ein Stadtfilter liefert auch bundesweite Angebote; mehr als 100 Treffer sind über next_offset vollständig paginiert abrufbar.',
  },
  {
    name: TOOL_NAMES.recommendClinics,
    description:
      'Zeigt per eindeutiger Verzeichnis-ID ausgewählte Law Clinics als Karten an (Name, Region, Rechtsgebiete, Kontakt). Erst dieser Aufruf bringt Empfehlungen sichtbar auf die Seite.',
  },
  {
    name: TOOL_NAMES.reportNoMatch,
    description:
      'Zeigt die Karte „Wie es weitergeht", wenn keine passende Law Clinic gefunden wurde. Danach ist der Ablauf beendet.',
  },
];

/**
 * Tool descriptions. These steer WHEN the model reaches for a tool, while the
 * skill (stored in settings) steers the overall flow.
 */
export const SEARCH_CLINICS_DESCRIPTION = `Searches the directory of published German law clinics. Filter by city, legal area (German term, e.g. "Mietrecht"), language, target group, and/or a free-text query. Matching is a case-insensitive substring match, so take the filter values from list_directory_terms rather than inventing synonyms that will not match. A city filter also returns nationwide clinics. Results are stable pages of up to 100 clinics. The JSON count is the total number of matches. If next_offset is a number, more matches exist: call search_clinics again with the same filters and offset set to that next_offset until it is null whenever you need to inspect the complete result set.`;

export const LIST_DIRECTORY_TERMS_DESCRIPTION = `Returns the legal areas, regions, languages and target groups that actually appear in the published directory, as JSON lists. The directory is inconsistent free text, so call this BEFORE searching and pick your search_clinics filter values (legal_area, city, language, target_group) from these lists — a synonym that is not in the directory will not match. The lists reflect the current directory; call it once per conversation and reuse the result.`;

export const RECOMMEND_CLINICS_DESCRIPTION = `Presents the chosen law clinics to the user as ranked cards in the page, with name, region, legal areas and contact buttons rendered by the website. Call this once you know which clinics fit, listing them best-first and giving a short reason per clinic. Use the exact clinic id from search_clinics — ids that do not match a published directory row are dropped. The cards already show the details, so keep the message around them short and do not repeat the list in prose.`;

export const REPORT_NO_MATCH_DESCRIPTION = `Call this when you have concluded that no suitable law clinic can be offered — after a broadened second search_clinics still returns nothing that fits. First write a short, kind apology in the user's language; then call this tool once. It displays the standard "ways forward" card (broaden the search, start over, apply for Beratungshilfe at the local court), so do not list those steps in your own text. Never invent a clinic instead of calling this.`;
