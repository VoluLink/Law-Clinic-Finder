# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Hinzugefügt

- **Umfassende Region-Vorschläge:** Das Feld „Region / Stadt" schlägt jetzt „Bundesweit", alle 16
  Bundesländer, alle 19 Regierungsbezirke (präfigiert, z. B. „Regierungsbezirk Köln") und alle 79
  deutschen Großstädte vor. Die Liste ist die einzige Quelle für Mitglieder-, Admin- und
  Signup-Formular.
- **Lese-/Bearbeiten-Ansicht im Mitgliederbereich:** Der eigene Eintrag wird zuerst schreibgeschützt
  angezeigt; erst „Bearbeiten" macht die Felder editierbar und blendet „Speichern" und „Abbrechen"
  ein.
- **„Abbrechen"-Button** verwirft ungespeicherte Änderungen — im Mitglieder-Formular und in der
  Admin-Datenbanktabelle (beide kehren zur Lese-Ansicht zurück und verwerfen alle Änderungen).
- **Tabellenweites Speichern in der Admin-Datenbank:** Der frühere „Fertig"-Knopf ist jetzt
  „Speichern"; er sichert alle geänderten Zeilen auf einmal und kehrt zur Lese-Ansicht zurück. Die
  einzelnen Speichern-/Abbrechen-Knöpfe pro Zeile entfallen, nur „Zeile löschen" bleibt pro Zeile.
- **„Speichern" bleibt ausgegraut, solange nichts geändert wurde** — im Mitglieder-Formular und in
  der Admin-Tabelle, über die gemeinsame `EditActions`-Komponente.
- **E-Mail-Felder akzeptieren nur noch gültige Adressen.** Eine gemeinsame Prüfung (`emailValue`/
  `isValidEmail`) liegt allen E-Mail-Eingaben zugrunde: Das Beratungsemail-Feld im Mitglieder-Formular
  ist jetzt ein `type="email"`-Feld, die Admin-Kontoänderung blockiert das Speichern bei ungültiger
  Adresse mit einem Inline-Hinweis, und die Admin-Datenbanktabelle verweigert das tabellenweite
  Speichern und benennt die betroffene Law Clinic, wenn eine Beratungsemail keine gültige Adresse ist.
  Die Fehlermeldung ist einheitlich deutsch.

- **Hinweiskarte statt Chatbox**: Ist der Chatbot deaktiviert oder unkonfiguriert, zeigt die
  Startseite jetzt schon beim Laden die gestaltete `ChatUnavailable`-Karte („später erneut
  versuchen", übersetzt in allen 9 Sprachen) statt der Chatbox — bisher erschien der Hinweis erst
  nach dem Absenden einer Nachricht.
- **Toggle-Komponente** im UI-Kit; der Kill-Switch im KI-Assistent-Tab heißt jetzt
  „Chatbot aktiviert" und ist ein Schalter statt einer Checkbox.
- **Standardfassung & Zurücksetzen im KI-Tab:** Neben Rolle und Ablauf hält die Datenbank eine
  eingefrorene Standardfassung (`chat_system_prompt_default`/`chat_skill_default`); ein Button
  „Auf Standard zurücksetzen" stellt sie im Tab wieder her.
- **Toolbox im KI-Tab:** eine Referenz der im Ablauf verwendbaren Werkzeuge (`list_directory_terms`,
  `search_clinics`, `recommend_clinics`, `report_no_match`) mit Erklärungen, damit Admins die Namen
  beim Bearbeiten des Ablaufs korrekt wiederverwenden.
- **Warnung im KI-Tab**, wenn Rolle oder Ablauf leer sind und der Chatbot deshalb nicht arbeiten
  kann — Ratsuchende sehen dann die Hinweiskarte statt des Chats.
- **Monats-Navigator im Admin-Dashboard:** Die KI-Statistiken (Interaktionen, API-Kosten,
  Vermittlungsquote, Rechtsgebiete, Balkendiagramm) lassen sich jetzt monatsweise vor- und
  zurückblättern. Das Fenster reicht ein Jahr zurück (bis zum ältesten aufbewahrten Monat) und nicht
  über den aktuellen Monat hinaus.
- **Automatische Datenaufbewahrung:** Der detaillierte Chat-Verlauf bleibt nur noch für die neuesten
  200 Gespräche gespeichert; ältere behalten ihre anonyme Statistik. Ein tägliches Aufräumen löscht
  Gespräche-Statistiken, `clinic_events` und das Einladungs-Log ein Jahr nach Monatsende. Ausgenommen
  bleiben Protokolle (eigene 7-Tage-Regel), offene Registrierungen (bis zur Admin-Entscheidung) und
  alle Stammdaten. Die Mitglieder-Statistik ist damit rollierend über zwölf Monate.

### Geändert

- **Durchgängige Du-Ansprache:** Alle deutschen Texte sprechen Ratsuchende, Mitglieder und Admins
  jetzt einheitlich mit „du" an (vorher teils „Sie") — inklusive der Hinweiskarte „Assistent zurzeit
  nicht verfügbar", der Limit- und Fehlermeldungen im Chat, der Login-, Signup-, Datenschutz- und
  Formulartexte sowie der gemeinsamen E-Mail-Fehlermeldung.
- **Nationwide-Region heißt jetzt „Bundesweit"** (vorher „Deutschlandweit"). Der Sentinel im
  Chat-Werkzeug `list_directory_terms`, die Stadt-plus-nationwide-Suche und bestehende Verzeichnis-
  Einträge (per Migration) wurden angeglichen.
- **`settings` ist die einzige Quelle für alle Regler des KI-Assistenten — kein Code-Fallback mehr.**
  Rolle und Ablauf leben nur noch in der Datenbank (`chat_system_prompt`/`chat_skill`) und werden pro
  Anfrage von dort gelesen; `src/lib/chat/prompts.ts` enthält keinen Prompt-Text mehr, nur die
  code-seitigen Tool-Beschreibungen, den Redaktions-Prompt und die Toolbox-Referenz. Der Startwert
  wird per versionierter Supabase-Migration gesät; fehlt ein Pflichtwert oder ist er ungültig, gilt
  der Chat als nicht verfügbar statt auf Code zurückzufallen. Die frühere „override-only"-/
  Fallback-Logik in `prompts.ts` entfällt.
- Der Next.js-Dev-Indikator (das „N" unten links) ist per `devIndicators: false` ausgeblendet.

### Behoben

- Der Live-Chatbot nutzte einen veralteten, in der Datenbank eingefrorenen „Ablauf" und feuerte die
  „Kein Treffer"-Karte (`report_no_match`) nie; die eingefrorenen Prompt-Zeilen wurden an den
  aktuellen `prompts.ts`-Stand angeglichen.
- `npm run typecheck` schlug in einem frischen Clone fehl: `next-env.d.ts` wird von Next generiert
  und ist daher nicht eingecheckt, ohne die Datei fehlen die Typdeklarationen für Bild-Importe.
  Das Skript ruft jetzt vorab `next typegen` auf.

## [0.1.0-alpha.1] - 2026-07-20

Erste Vorabversion. Funktionsumfang unvollständig, nicht produktionsreif.

### Hinzugefügt

- **Öffentliche Startseite** mit eingebettetem FinderChat: streamender Tool-Use-Loop mit zwei
  Werkzeugen — `search_clinics` liest das Verzeichnis, `recommend_clinics` gibt die Auswahl samt
  Begründung zurück. Der Server schlägt jeden empfohlenen Namen in der Datenbank nach und baut
  daraus die Empfehlungskarten, sodass ein erfundener Name herausfällt statt beim Ratsuchenden
  zu landen.
- **NDJSON-Stream-Protokoll** für `/api/chat`: eine JSON-Zeile pro Frame (`text`, `clinics`),
  Teilzeilen werden gepuffert, unbekannte oder ungültige Frames übersprungen.
- **Mehrsprachigkeit** im öffentlichen Bereich: 9 Sprachen (Standard Deutsch, dazu Englisch,
  Arabisch, Französisch, Kurdisch, Persisch, Russisch, Ukrainisch, Türkisch) mit RTL-Unterstützung,
  Sprachwahl über den `lcf_lang`-Cookie.
- **Passwortloses Login** für Clinics und Admins über einen gemeinsamen Magic-Link-Flow
  (nur auf Einladung), OTP-Verifikation über `token_hash`.
- **Clinic-Bereich** zum Bearbeiten des eigenen Verzeichniseintrags.
- **Admin-Bereich**: Dashboard mit Kennzahlen, Clinics-CRUD, Einladungen, Freigabe-Warteschlange,
  Einsicht in redigierte Konversationen, Einstellungen.
- **Selbstregistrierung** unter `/signup`: Verzeichnis durchsuchen, bestehenden Eintrag
  beanspruchen (Einladung ausschließlich an die hinterlegte Adresse) oder neue Clinic zur
  Freigabe einreichen.
- **Datenschutz im Chat**: Transkripte werden nach Streamende redigiert (Regex-Vorlauf plus
  Modellaufruf, Zod-validiert) und nur in redigierter Form gespeichert.
- **Postgres-Schema mit Row Level Security** als versionierte SQL-Migrationen; Rollenprüfung
  dreifach in Proxy, `requireRole` und RLS. `anon` erhält ausschließlich spaltenweise Grants.
- **Missbrauchs- und Kostenschutz**: Same-Origin-Prüfung, Rate-Limits pro IP (pro Minute und pro
  Tag), Budgets für Nachrichtenanzahl, Zeichenzahl, Tool-Ergebnisse und Antwort-Tokens.
- **Strukturiertes Logging** als JSON sowie typisierte Fehlerklassen.
- **UI-Kit** mit Badge, Button, Card, Checkbox, Input, Modal, Textarea und StageShell; sämtliche
  Design-Werte als Tokens in `globals.css`.
- **Portables Deployment**: `output: 'standalone'` und mehrstufiges Dockerfile mit
  Nicht-Root-Laufzeitbenutzer.
- **Qualitätssicherung**: Vitest mit kolozierten Tests, TypeScript im Strict-Modus, ESLint,
  Prettier.

### Bekannte Einschränkungen

- Die Verifikation der E-Mail-Inhaberschaft bei der Neuregistrierung fehlt noch; Einreichungen
  werden ausschließlich manuell durch Admins freigegeben.
- Impressum und Datenschutzerklärung enthalten Platzhaltertexte.
- Rate-Limits werden im Arbeitsspeicher gehalten und gelten daher pro Prozess; beim Deployment
  hinter einem Proxy muss dieser `X-Forwarded-For` selbst setzen.
- Keine sprachspezifischen URLs; die Sprachwahl läuft über einen Cookie.

[Unreleased]: https://github.com/hackerFlo/Law-Clinic-Finder/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/hackerFlo/Law-Clinic-Finder/releases/tag/v0.1.0-alpha.1
