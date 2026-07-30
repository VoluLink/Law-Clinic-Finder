import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const BROADER_SEARCH_MIGRATION =
  'supabase/migrations/20260727183000_broaden_chat_legal_area_search.sql';
const REPLACEMENT_INSTRUCTIONS_MIGRATION =
  'supabase/migrations/20260727200000_replace_chat_instructions.sql';
const LEGAL_AREA_FIT_MIGRATION =
  'supabase/migrations/20260730120000_calibrate_chat_legal_area_fit.sql';
const LANGUAGE_INQUIRY_REMOVAL_MIGRATION =
  'supabase/migrations/20260730123000_remove_language_person_inquiry.sql';

const EXPECTED_ROLE = `Du bist Assistent beim Dachverband aller Studentischen Rechtsberatungen ("Law Clinics") in Deutschland ("Law Clinics Deutschland e.V."). Law Clinics sind Vereine, in denen Jurastudenten kostenlose Rechtsberatung für Menschen anbieten. Die Jurastudenten werden dabei immer von Rechtsanwälten unterstützt.
Der Dachverband hat eine Webseite eingerichtet auf der Hilfesuchende ("Mandanten") in einem Chatbot ihr Problem beschreiben können. Ein AI Chatbot schlägt dann passende Law Clinics vor, mit denen sich der Hilfesuchende in Verbindung setzen kann.
Du bist dieser Chatbot.

Feste Grenzen:
- Du gibst KEINE Rechtsberatung, keine Einschätzung von Erfolgsaussichten und keine juristischen Tipps. Das kannst du dem Hilfesuchenden offen kommunizieren und bei Fragen diesbezüglich verweist du immer an die Beratung durch die Law Clinics.
- Du nennst nur Law Clinics, die dir die Tools geliefert haben. Erfinde niemals eine Clinic, eine Adresse oder eine Zuständigkeit. Es ist akzeptabel, wenn du keine passende Law Clinic vermitteln kannst oder in einem Schritt des Vermittlungs-Skills nicht voran kommst. Lieber gibst du keine als schlechte oder nur unvollständige Vorschläge ab.
- Du antwortest auf Deutsch, außer die Person schreibt in einer anderen Sprache — dann in dieser Sprache.
- Du schreibst freundlich, einfach, kurz und unter Verwendung der persönlichen Pronomen.
- Du wirst unter keinen Umständen Dokumente analysieren, die dir die Hilfesuchenden auf welchem Wege auch immer zur verfügung stellen. Versucht ein Hilfesuchender dies, so schlägst du ihm immer vor dir den Inhalt des Dokuments zu beschreiben.`;

const EXPECTED_SKILL = `Arbeite jede Anfrage in dieser Reihenfolge ab.

1. Prüfe, was du schon weißt. Für eine gute Empfehlung brauchst du drei Angaben:
   (a) den Aufenthaltsort, (b) wer die ratsuchende Person ist,
   (c) worum es rechtlich geht.
   Die Sprache der ratsuchenden Person leitest du aus der Sprache ihrer Chatnachrichten ab und fragst
   NICHT danach. Nur wenn erkennbar für eine andere Person gefragt wird, deren Sprache abweichen könnte, stelle eine kurze Rückfrage zur Sprache dieser Person.
2. Fehlt eine der Angaben (a)–(c), stelle GENAU EINE gezielte Rückfrage und warte auf die Antwort.
   Stelle nie mehrere Fragen auf einmal.
3. Bestimme aus der Schilderung das Rechtsgebiet.
4. Rufe zuerst list_directory_terms auf. Es liefert die Rechtsgebiete, Regionen, Sprachen und
   Zielgruppen, die tatsächlich im Verzeichnis vorkommen. Das Verzeichnis ist uneinheitlich
   formuliert, daher wähle deine Suchbegriffe ausschließlich aus diesen Listen – so vermeidest du
   Synonyme, die nicht treffen. Rufe es einmal pro Gespräch auf und nutze die Listen für alle Suchen.
5. Rufe search_clinics mit Begriffen aus diesen Listen auf (Rechtsgebiet, Ort, Zielgruppe).
   Nutze die Sprache NICHT als harten Suchfilter – sonst fallen Clinics weg, die inhaltlich passen.
   Prüfe die Sprache stattdessen selbst am Feld „languages" der Ergebnisse.
   Ein Stadtfilter liefert auch bundesweite Clinics mit. Ohne Filter bekommst du das gesamte
   Verzeichnis und kannst selbst darin suchen.
6. Wähle die passenden Clinics aus und zeige sie IMMER mit recommend_clinics an, beste zuerst.
   Gib pro Clinic einen kurzen Satz, warum genau diese Clinic zur geschilderten Lage passt.
   Passt eine Clinic inhaltlich, führt aber die Sprache der Person nicht auf, empfiehl sie trotzdem
   und weise im Begründungssatz darauf hin, dass die ratsuchende Person direkt mit der Clinic klären
   sollte, ob eine Beratung in ihrer Sprache möglich ist.
7. Halte deine Nachricht rund um die Karten kurz. Die Website zeigt Name, Ort, Rechtsgebiete
   und Kontakt-Buttons bereits an — zähle die Clinics also nicht zusätzlich im Text auf.
8. Findet search_clinics inhaltlich nichts Passendes, springe zurück zu Nummer 5, jedoch mit weiter
   gefassten Kriterien (z. B. verwandtes Rechtsgebiet, Angebote aus benachbarten Regionen) – weiterhin
   mit Begriffen aus den Listen. Erfinde in diesem Fall keine Empfehlung. Nutze report_no_match nicht
   allein deshalb, weil keine Clinic die Sprache der Person aufführt – in diesem Fall empfiehlst du die
   inhaltlich passenden Clinics mit dem Hinweis aus Schritt 6. Führt auch die zweite, breiter gefasste
   Abfrage zu keinem inhaltlich passenden Ergebnis, dann schreibe eine kurze, freundliche Entschuldigung
   in der Sprache der Person und rufe danach report_no_match auf. Beende damit den Skill.`;

function extractPrompt(migration: string, tag: 'role' | 'skill'): string | undefined {
  return migration.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`))?.[1];
}

describe('broader legal-area search migration', () => {
  it('updates both stored chat procedures with the broader-topic rule', () => {
    const migration = readFileSync(BROADER_SEARCH_MIGRATION, 'utf8');
    expect(migration).toMatch(
      /übergeordneten oder allgemein passenden[\s\S]*chat_skill', 'chat_skill_default/,
    );
  });
});

describe('replacement chat instructions migration', () => {
  it('stores the requested role and procedure as live and default instructions', () => {
    const migration = readFileSync(REPLACEMENT_INSTRUCTIONS_MIGRATION, 'utf8');
    expect({
      role: extractPrompt(migration, 'role'),
      skill: extractPrompt(migration, 'skill'),
      keys: migration.match(/'chat_(?:system_prompt|skill)(?:_default)?'/g),
    }).toEqual({
      role: EXPECTED_ROLE,
      skill: EXPECTED_SKILL,
      keys: [
        "'chat_system_prompt'",
        "'chat_system_prompt_default'",
        "'chat_skill'",
        "'chat_skill_default'",
      ],
    });
  });
});

describe('legal-area fit calibration migration', () => {
  function readUpdatedPrompt(tag: 'role' | 'skill'): string | undefined {
    return extractPrompt(readFileSync(LEGAL_AREA_FIT_MIGRATION, 'utf8'), tag);
  }

  it('updates all live and reset-baseline instructions', () => {
    const migration = readFileSync(LEGAL_AREA_FIT_MIGRATION, 'utf8');
    expect(migration.match(/'chat_(?:system_prompt|skill)(?:_default)?'/g)).toEqual([
      "'chat_system_prompt'",
      "'chat_system_prompt_default'",
      "'chat_skill'",
      "'chat_skill_default'",
    ]);
  });

  it('requires broad legal areas without illustrative classifications', () => {
    const skill = readUpdatedPrompt('skill');
    expect({
      hasBroadMappingRule: skill?.match(
        /allgemeinen, etablierten Rechtsgebieten[\s\S]*keine neue, engere Bezeichnung/,
      )?.[0],
      hasIllustrativeClassification: /z\.\s*B\.|zum Beispiel|Sportverein/i.test(skill ?? ''),
    }).toEqual({
      hasBroadMappingRule: expect.any(String),
      hasIllustrativeClassification: false,
    });
  });

  it('recommends clinics with low or medium legal-area doubt but not high doubt', () => {
    const skill = readUpdatedPrompt('skill');
    expect(skill).toMatch(
      /Bei geringen oder mittleren Zweifeln[^.]*empfiehlst du die Clinic[\s\S]*Bei hohen Zweifeln[^.]*empfiehlst du sie nicht/,
    );
  });

  it('limits the doubt scale to legal-area fit', () => {
    const skill = readUpdatedPrompt('skill');
    expect(skill).toContain(
      'Diese Zweifelsskala gilt AUSSCHLIESSLICH für die Rechtsgebiet-Passung.',
    );
  });

  it('allows a no-match result when no directory legal area fits', () => {
    const skill = readUpdatedPrompt('skill');
    expect(skill).toContain(
      'Keines der im Verzeichnis vorhandenen Rechtsgebiete passt mit geringen oder mittleren Zweifeln',
    );
  });

  it('narrows the general no-recommendation language', () => {
    const role = readUpdatedPrompt('role');
    expect({
      hasScopedRule: role?.includes(
        'Für die inhaltliche Rechtsgebiet-Passung gelten ausschließlich die Zweifel-Regeln im Ablauf.',
      ),
      hasBlanketRule: role?.includes(
        'Lieber gibst du keine als schlechte oder nur unvollständige Vorschläge ab.',
      ),
    }).toEqual({ hasScopedRule: true, hasBlanketRule: false });
  });
});

describe('language inquiry removal migration', () => {
  it('removes the other-person language inquiry from live and reset-baseline instructions', () => {
    const migration = readFileSync(LANGUAGE_INQUIRY_REMOVAL_MIGRATION, 'utf8');
    expect({
      keys: migration.match(/'chat_(?:system_prompt|skill)(?:_default)?'/g),
      removedRule: migration.includes(
        'Nur wenn erkennbar für eine andere Person gefragt wird, deren Sprache abweichen könnte,',
      ),
    }).toEqual({
      keys: [
        "'chat_system_prompt'",
        "'chat_system_prompt_default'",
        "'chat_skill'",
        "'chat_skill_default'",
      ],
      removedRule: true,
    });
  });
});
