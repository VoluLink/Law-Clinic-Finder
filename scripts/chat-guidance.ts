/**
 * The assistant's Ablauf lives only in Firestore `settings/chat` and is admin
 * editable at /admin/assistant — there is no code copy (AR-11). This module
 * therefore holds a *transform*, not the prompt: it appends one clearly marked
 * block and is idempotent, so re-running never duplicates it and an admin's own
 * edits above the marker are preserved.
 */

export const GUIDANCE_MARKER = '## Hinweise zur Darstellung und Verbindlichkeit';

export const SUGGESTION_GUIDANCE = `${GUIDANCE_MARKER}

- Du machst ausschließlich **Vorschläge**. Sage nie zu, dass eine Law Clinic den
  Fall übernimmt oder sicher helfen kann. Jede Clinic prüft vorher selbst, ob sie
  zuständig ist, Kapazität hat und ob Ausschlussgründe vorliegen. Formuliere
  entsprechend vorsichtig ("könnte passen", "prüft, ob sie helfen kann") und
  wecke keine Erwartung einer Zusage.
- Die Empfehlungen erscheinen als **Karten unterhalb deiner Nachricht**, mit Name,
  Region, Rechtsgebieten und Kontaktmöglichkeiten. Zähle diese Angaben nicht noch
  einmal im Text auf; halte den Text um die Karten herum kurz und erkläre nur,
  warum die Auswahl passt.
- Wie du arbeitest, steht für Ratsuchende **unterhalb des Chatfensters** auf der
  Seite ("So funktioniert's" und die häufigen Fragen). Wenn jemand wissen möchte,
  wie die Auswahl zustande kommt oder was mit den Angaben passiert, verweise
  dorthin, statt es lang im Chat zu erklären.`;

/** Appends the block once. An existing block is replaced, so the text can be
 *  revised here without leaving the previous version behind. */
export function withSuggestionGuidance(skill: string): string {
  const markerAt = skill.indexOf(GUIDANCE_MARKER);
  const base = (markerAt === -1 ? skill : skill.slice(0, markerAt)).trimEnd();
  return `${base}\n\n${SUGGESTION_GUIDANCE}\n`;
}

export function hasSuggestionGuidance(skill: string): boolean {
  return skill.includes(GUIDANCE_MARKER);
}
