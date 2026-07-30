# Law Clinic Finder

Verzeichnis der deutschen Law Clinics mit KI-Chat, der Ratsuchende an die passende Clinic
weiterleitet. Eine Next.js-Anwendung mit rollengetrenntem Clinic- und Admin-Bereich und
passwortlosem Login.

> **Status: Vorabversion (Alpha).** Die Anwendung ist nicht produktionsreif. Schnittstellen,
> Datenmodell und Konfiguration können sich jederzeit ohne Ankündigung ändern.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Supabase
(Postgres, Auth, RLS) · Anthropic Claude API · Vitest · Zod

## Einrichtung & Betrieb

```bash
npm install                                    # Abhängigkeiten installieren
cp .env.example .env.local                     # Zugangsdaten eintragen (siehe unten)
npm run dev                                    # Entwicklungsserver, http://localhost:3000

npm test                                       # Vitest (Unit-Tests, koloziert als *.test.ts[x])
npm run typecheck                              # tsc --noEmit
npm run lint                                   # ESLint
npm run format:check                           # Prettier

npm run build                                  # Produktions-Build
docker build -t law-clinic-finder .            # portables Produktions-Image (output: standalone)

node scripts/import-clinics.mjs <clinics.json> # idempotenter Import (Upsert über den Namen)
```

### Umgebungsvariablen

`.env.example` listet alle benötigten Variablen. Reale Werte gehören ausschließlich in
`.env.local` und werden nie eingecheckt.

| Variable                        | Bereich    | Zweck                                                     |
| ------------------------------- | ---------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | öffentlich | Supabase-Projekt-URL                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | öffentlich | Anon-Key, spaltenweise per RLS beschränkt                 |
| `SUPABASE_SECRET_KEY`           | Server     | Service-Key, umgeht RLS — niemals `NEXT_PUBLIC_`          |
| `ANTHROPIC_API_KEY`             | Server     | Claude API ausschließlich für Chat-Antworten              |
| `DEV_LOGIN_ENABLED`             | nur Dev    | Schaltet die E-Mail-freien Test-Logins frei               |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | öffentlich | GA4-Mess-ID; aktiviert einwilligungsbasiertes Tracking    |
| `GA_PROPERTY_ID`                | Server     | GA4-Property für die Dashboard-Kennzahlen (Data API)      |
| `GA_SERVICE_ACCOUNT_JSON`       | Server     | Service-Account für die GA Data API (Dashboard-GA-Karten) |

`DEV_LOGIN_ENABLED` darf in Produktion nie gesetzt sein. Die zugehörige Route antwortet
zusätzlich mit 404, sobald `NODE_ENV=production` gilt.

## Architektur

Einstiegspunkte: `src/app/layout.tsx` (Root-Layout), `src/proxy.ts` (Rollen-Gating; ersetzt
`middleware.ts` ab Next 16; Matcher `/admin/*`, `/clinic/*`), API-Routen unter `src/app/api/`.

| Pfad                         | Zweck                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/page.tsx`           | Öffentliche Startseite mit eingebettetem FinderChat (oder `ChatUnavailable`-Hinweis, wenn der Chatbot aus/unkonfiguriert ist)                                                                                                                                                                                         |
| `src/app/login/`             | Gemeinsames Login für Clinics und Admins (Magic Link, nur auf Einladung)                                                                                                                                                                                                                                              |
| `src/app/signup/`            | Selbstregistrierung: Verzeichnis durchsuchen → Eintrag beanspruchen oder neu                                                                                                                                                                                                                                          |
| `src/app/auth/confirm/`      | OTP-Verifikation via `token_hash`; aktiviert den Zugang einmalig und veröffentlicht eine vollständige Clinic bei erster Einladung bzw. deren Ersatz-Magic-Link automatisch                                                                                                                                            |
| `src/app/clinic/`            | Clinic-Bereich (Teal-Sidebar-Shell): Mein Eintrag, Statistiken (Empfehlungen/Klicks), Konto (Selbst-Löschung)                                                                                                                                                                                                         |
| `src/app/admin/`             | Admin: Teal-Sidebar-Shell — Dashboard (monatsweise navigierbare Statistik + Gespräche-Drawer mit API-Kosten und empfohlenen Clinic-Karten), Law Clinics, KI-Assistent, Protokolle, Branding, Konto                                                                                                                    |
| `src/app/api/chat/`          | Streamender Claude-Tool-Use-Loop; speichert redigierte Konversationen + Empfehlungs-Events                                                                                                                                                                                                                            |
| `src/app/api/clinic/`        | Clinic-Self-Service: eigenen Eintrag bearbeiten (`PATCH`), Konto löschen (`DELETE /account`: unpublish + Login weg)                                                                                                                                                                                                   |
| `src/app/api/clinic-events/` | Öffentlicher Klick-Beacon (Website/E-Mail); same-origin, rate-limitiert, nur veröffentlichte Clinics, PII-frei                                                                                                                                                                                                        |
| `src/app/api/signup/`        | Öffentliche API: Suche, Beanspruchung, Registrierung                                                                                                                                                                                                                                                                  |
| `src/app/api/admin/**`       | Admin-CRUD: Clinics, Einladungen, Zugang-Reset, Einreichungen, Einstellungen, Branding, Protokolle                                                                                                                                                                                                                    |
| `src/components/ui/`         | UI-Kit: Badge, Button, Card, Checkbox, ColorField, Drawer, FieldLabel, FileDropzone, Icon, InfoHint, Input, Modal, Panel, Select, SuggestionList, TagCombobox, StatCard, BarChart, MeterList, Textarea, Toggle                                                                                                        |
| `src/lib/branding/`          | Branding-Record laden/validieren; Runtime-Theming (`:root`-Tokens + Google-Font) im Root-Layout                                                                                                                                                                                                                       |
| `src/lib/analytics/`         | GA4-Consent (Mode v2) + Data-API-Kennzahlen (`ga-metrics.ts`, leer bis konfiguriert)                                                                                                                                                                                                                                  |
| `src/components/analytics/`  | GA-Script (einwilligungsgesteuert) + Cookie-Consent-Banner                                                                                                                                                                                                                                                            |
| `src/components/admin/`      | AdminChrome (Admin-Navigation via `PortalShell`), MonthStepper (Monats-Navigator des Dashboards)                                                                                                                                                                                                                      |
| `src/components/layout/`     | Wordmark, AreaHeader, `PortalShell` (geteilte Teal-Sidebar für Admin- **und** Clinic-Portal, aktive Tabs via `usePathname`)                                                                                                                                                                                           |
| `src/components/chat/`       | FinderChat (Suchkarte → Chat; strukturierte Abschluss-, Kein-Treffer- und Limit-Zustände), Empfehlungskarten (Klick-Beacon auf Website/E-Mail), browserlokaler PDF-/Text-Export mit der letzten Empfehlungsliste (das PDF zeigt nur die erste Nutzerangabe; der Text-Export bleibt vollständig) und `ChatUnavailable` |
| `src/lib/chat/`              | Tool-Texte, Schema, Tools, NDJSON, Loop, deterministische PII-Redaktion, `usage.ts` (Token/Kosten pro Gespräch)                                                                                                                                                                                                       |
| `src/lib/clinic/`            | `stats.ts`: Kennzahlen des Statistik-Tabs (Empfehlungen, Klicks, Klickrate)                                                                                                                                                                                                                                           |
| `src/lib/admin/`             | Dashboard-Kennzahlen (`stats.ts`), Zugriffsstatus (`clinic-access.ts`), Monatsfenster (`month-window.ts`: rollierende 12-Monats-Aufbewahrung, Monatsschritte)                                                                                                                                                         |
| `src/lib/clinics/`           | `revoke-access.ts` (Login löschen + Eintrags-Reset), `click-event.ts` (Klick-Recorder), `schema.ts`, `options.ts` (Vorschlagslisten + `;`-Parser), `publish-requirements.ts` (Pflichtfeld-Gate zum Veröffentlichen)                                                                                                   |
| `src/lib/logs/`              | `log-store.ts`: Sink, der Logs in `public.logs` schreibt (7 Tage Aufbewahrung)                                                                                                                                                                                                                                        |
| `src/instrumentation.ts`     | Next-Startup-Hook: verbindet den Logger mit dem `logs`-Sink                                                                                                                                                                                                                                                           |
| `src/lib/i18n/`              | Wörterbücher für 9 Sprachen, `lcf_lang`-Cookie, RTL-Hilfen und lokaler Englisch-Fallback für nicht unterstützte Chatsprachen                                                                                                                                                                                          |
| `src/lib/signup/`            | Verzeichnissuche, E-Mail-Maskierung, Beanspruchungsfenster, Registrierung                                                                                                                                                                                                                                             |
| `src/lib/supabase/`          | Clients: Browser, Server (Cookies), Service (nur Server), Proxy-Session                                                                                                                                                                                                                                               |
| `src/lib/auth/`              | `requireRole` (+ `AuthError`), Admin-Guard für API-Routen                                                                                                                                                                                                                                                             |
| `src/lib/`                   | Logger (strukturiertes JSON, optional in `logs`-Tabelle), Rate-Limiting, Einstellungen, `cn`, Schemata                                                                                                                                                                                                                |
| `supabase/migrations/`       | Schema und RLS — alleinige Quelle der Wahrheit                                                                                                                                                                                                                                                                        |
| `scripts/`                   | Zod-validierter Clinic-Import, Dev-Hilfsskripte                                                                                                                                                                                                                                                                       |

**Datenfluss:** Browser → API-Route (Zod-Validierung, `requireRole`) → Supabase (Postgres + RLS)
→ Antwort. Beim Chat redigiert `/api/chat` alle Nachrichten mit lokalen, deterministischen Regeln,
bevor die Texte die Anthropic-API erreichen. Nach Streamende redigiert `after()` das vollständige
Transkript nochmals lokal und legt es mit Kennzahlen ab; das nachgefragte Rechtsgebiet stammt
vorrangig aus dem validierten `search_clinics`-Filter, mit lokaler Texterkennung als Fallback. Das
`search_clinics`-Werkzeug gibt dem Modell ausschließlich Verzeichnisdaten ohne Beratungsemails;
eine E-Mail-Adresse wird erst für eine konkret serverseitig geprüfte Empfehlungskarte an den Browser
gegeben.

**Authentifizierungs-E-Mails:** Supabase Auth erzeugt Einladungs-, Magic-Link- und
E-Mail-Änderungs-Tokens; ein in Supabase konfigurierter SMTP-Anbieter stellt alle drei Mailarten zu.
Die Auth-Mailvorlagen werden im Supabase-Dashboard gepflegt und verlinken mit `TokenHash` auf
`/auth/confirm`. Für den Produktivbetrieb ist Custom SMTP erforderlich; der Supabase-Free-Tarif
erlaubt Custom SMTP, sein eingebauter Testversand ist jedoch nicht für beliebige Empfänger gedacht.
Eine Clinic-Einladung legt sofort Auth-User und Profil an. `profiles.activated_at` unterscheidet
seitdem eine noch offene Einladung von einem tatsächlich erstmals angemeldeten Zugang: Ein
Ersatz-Magic-Link kann die einmalige Auto-Veröffentlichung auslösen, spätere Logins niemals. Die
Admin-E-Mail-Änderung überträgt denselben Auth-User und damit dieselbe Admin-Rolle nach Bestätigung
auf die neue Adresse; sie legt keinen zweiten Admin an.

**Privatsphäre im Chat:** E-Mail-Adressen, Telefonnummern, IBANs, deutsche Straßenanschriften und
Namen in eindeutigen Namenskontexten werden durch `redactPatterns` schon **vor** dem
Anthropic-Aufruf entfernt. Für die Redaktion wird nie eine KI-API aufgerufen. Dieselben Regeln
laufen vor dem Speichern erneut; Rechtsgebiet und Stadt werden für Statistiken gegen kontrollierte
lokale Begriffslisten erkannt. Freitext-Anonymisierung kann Angaben außerhalb der bekannten Muster
nicht garantiert erkennen, deshalb bleibt der Hinweis bestehen, keine vollständigen Namen oder
Kontaktdaten einzugeben.

**Chat-Werkzeuge:** Das Modell hat genau vier serverseitig registrierte Tools.
`list_directory_terms` liest die tatsächlich vorhandenen Suchbegriffe aus veröffentlichten
Verzeichniseinträgen. `search_clinics` liest das Verzeichnis in stabil sortierten Seiten mit je 100
Einträgen; `count` und `next_offset` machen auch größere Verzeichnisse vollständig abrufbar, lange
Freitextfelder werden pro Zeile gekürzt — ohne Beratungsemail. `recommend_clinics` akzeptiert nur
eindeutige Clinic-IDs, die eine Suche im selben Gespräch geliefert hat; der Server schlägt jede ID
erneut in der Datenbank nach und sendet daraus die Karten. `report_no_match` zeigt ausschließlich
die feste Hilfe-Karte der Website und wird erst nach zwei erfolgreichen Datenbanksuchen akzeptiert.
Unbekannte Tool-Namen werden abgewiesen und führen niemals
ersatzweise eine Datenbankabfrage aus. Alles außer der kurzen Empfehlungsbegründung stammt damit aus
der Datenbank; erfundene oder nicht zuvor gelesene IDs fallen heraus. Die E-Mail-Adresse verlässt
diesen Server-Schritt nur als Teil der fertigen Empfehlungskarte, nie als Tool-Ergebnis für das
Modell.

**Pro-Clinic-Statistik:** Jede Empfehlung schreibt beim Speichern des Gesprächs ein
`recommended`-Event nach `public.clinic_events`; Klicks auf Website/E-Mail meldet ein Beacon der
Empfehlungskarte an `/api/clinic-events` (`click_website`/`click_email`). Die Events tragen **keine**
Nutzerdaten (nur Clinic-ID, Art, Zeitstempel). Der Statistik-Tab der Clinic liest sie über die View
`clinic_event_counts` (`security_invoker`, RLS auf `private.app_clinic_id()`) — **nur die eigenen
Zahlen, nicht für Admins**. Löscht ein Gespräch (DSGVO), bleibt der Zähler erhalten
(`conversation_id … on delete set null`). `clinic_events` wird nach 12 Monaten bereinigt (siehe
_Datenaufbewahrung_), die Mitglieder-Statistik ist also rollierend über ein Jahr.
Das Admin-Dashboard liest die verknüpften `recommended`-Events zusätzlich, um im anonymisierten
Gespräch am Ende des Verlaufs die aktuellen Karten der tatsächlich empfohlenen Clinics zu zeigen.

**System-Prompt = Rolle + Datengrundlage + Ablauf:** Der System-Prompt wird zur Laufzeit aus drei
DB-Texten zusammengesetzt (`buildSystemPrompt` in `src/lib/chat/prompts.ts`): `<role>` (wer der
Assistent ist), `<grounding>` (verbindliche Beschränkung auf aktuelle Datenbank-Tool-Ergebnisse) und
`<skill>` (der Gesprächsablauf). Rolle und Ablauf sind unter `/admin/assistant` editierbar; die
Grounding-Regel (`chat_grounding_policy`) wird ausschließlich per versionierter Migration gepflegt
und kann weder im Admin-Formular noch durch einen direkten authentifizierten Supabase-Schreibzugriff
überschrieben oder gelöscht werden. Fehlt einer der drei Werte, bleibt der Chat deaktiviert statt
auf einen Code- oder Modellwissen-Fallback auszuweichen.

**Grenzwerte des Chats** (Konstante → Datei → Wert):

| Grenze                  | Datei               | Wert            |
| ----------------------- | ------------------- | --------------- |
| Anfragen/Minute pro IP  | `rate-limit.ts`     | 20              |
| Anfragen/Tag pro IP     | `rate-limit.ts`     | 20              |
| `max_tokens` (Standard) | `settings.ts`       | 1024 (max 4096) |
| Temperatur (Standard)   | `settings.ts`       | 0.3             |
| Tool-Runden pro Antwort | `run-chat.ts`       | 5 (→ 6 Aufrufe) |
| Zeichen pro Nachricht   | `schema.ts`         | 4000            |
| Nachrichten im Verlauf  | `schema.ts`         | 16              |
| Treffer pro Suchseite   | `search-clinics.ts` | 100 (paginiert) |
| Empfohlene Clinics      | `settings.ts`       | ≤ 8 (Standard)  |

Das Rate-Limit liegt im Prozessspeicher (kein Redis) — pro Instanz und beim Neustart zurückgesetzt;
hinter mehreren Instanzen zusätzlich am Proxy erzwingen — der Proxy muss dafür
die echte Client-IP setzen (`X-Forwarded-For`).

## Konventionen

- **Next.js 16:** Request-APIs sind ausschließlich asynchron (`await cookies()`, `await params`);
  `proxy.ts` statt `middleware.ts`.
- **Design-Tokens:** Alle Farben, Abstände, Radien und Schatten liegen als Custom Properties in
  `src/app/globals.css`. Nie einen Rohwert im Komponentencode hartkodieren.
- **`cn` ist ein einfacher String-Join, kein `tailwind-merge`.** Ein `className`-Override schlägt
  eine Basis-Utility nicht — beide landen im Markup, die CSS-Reihenfolge entscheidet. Form- und
  Farbänderungen an geteilten Komponenten gehören daher in echte Varianten (`Button`
  `variant`/`shape`, `Input` `shape`, `Card` `variant`, `Badge` `variant`), nie in `className`.
- **Sprachen:** Der öffentliche Bereich liefert 9 Sprachen (Standard Deutsch; RTL für `ar`/`fa`)
  aus `src/lib/i18n/`. Login, Signup, Clinic- und Admin-Bereich bleiben deutsch. Code, Bezeichner
  und Kommentare sind englisch.
- **Nur-deutsche Landing-Texte:** Das Wörterbuch ist zweigeteilt. `Translations` sind die Schlüssel,
  die jede Locale-Datei selbst liefert; `GermanOnly` sind die Texte, die in jeder Sprache deutsch
  bleiben (Suchfeld-Platzhalter, KI-Hinweis, „So funktioniert diese Website", FAQ-Einträge zur
  studentischen Rechtsberatung). Sie stehen einmal in `deOnly` (`locales/de.ts`); `getDictionary`
  mischt sie über jede Locale. Locale-Dateien können diese Schlüssel nicht deklarieren — eine
  Übersetzung kann die deutsche Fassung also nicht überschreiben.
- **Datenbank-Rechte:** `anon` und `authenticated` erhalten ausschließlich explizite,
  spaltenweise Grants für die Directory-Tabelle, nie tabellenweite — ein Table-Grant hebt
  spaltenweise Revokes stillschweigend auf. `clinics.contact_email` ist für beide Rollen nicht
  lesbar; alles, was die Adresse braucht, läuft nach einer serverseitigen Rollenprüfung über den
  Service-Client. Sicherungstabellen sind für Web- und Service-Rollen vollständig gesperrt und
  erzwingen RLS ohne Richtlinie. Neue Tabellen und Funktionen erhalten standardmäßig keine dieser
  Rechte; jede nötige Freigabe gehört ausdrücklich in dieselbe Migration.
- **Clinic-Selbstverwaltung:** „Konto löschen“ entfernt den Login **und** setzt `is_published=false`,
  lässt den Verzeichnis-Eintrag aber bestehen — geteilte Logik `revokeClinicAccess(admin, id,
{ unpublish, clearContactEmail })`. Der Admin-Button „Zugang zurücksetzen“ entfernt Login und
  Beratungsemail (`clearContactEmail: true`), lässt den Veröffentlichungsstatus aber unverändert.
  Der Admin-Filter „Mit Konto verknüpft“ zeigt Einträge mit Mitglieds-Login (aktiv oder eingeladen);
  „Alle“ behält ausgeblendete/selbstgelöschte Einträge.
- **Geführte Dateneingabe:** Die Kategoriefelder `legal_areas`, `target_clients`, `languages` und
  `region` (alle Mehrfachauswahl via `TagCombobox`) schlagen standardisierte Werte aus
  `src/lib/clinics/options.ts` vor — der einzigen Quelle, die alle drei Eingabemasken
  (Mitglieder-Formular, Admin-Editor, öffentliche Registrierung) nutzen. Freitext bleibt erlaubt
  (geführt, nicht erzwungen). Die Speicherung ändert sich nicht: Mehrfachwerte liegen weiter als
  `"; "`-verkettetes `text` (`parseMultiValue`/`serializeMultiValue`), passend zu `search_clinics`
  (`ilike`) und den Empfehlungskarten (`splitAreas`). Bestandsdaten bleiben unangetastet.
  `"Bundesweit"` ist der reservierte bundesweite Sentinel und steht in den Regionsvorschlägen an
  erster Stelle; darauf folgen alle Bundesländer, Regierungsbezirke und Großstädte. Das
  Mitglieder-Formular zeigt den Eintrag zunächst schreibgeschützt und blendet Bearbeiten erst nach
  Klick auf „Bearbeiten" ein („Abbrechen" verwirft ungespeicherte Änderungen).
- **Feld-Hilfen & Pflichtkennzeichen:** Jedes Feld trägt in Admin-, Mitglieder- und
  Registrierungs-Ansicht ein `circle-info`-Symbol (`InfoHint`), das beim Hovern/Fokussieren einen
  Erklärtext zeigt — einzige Quelle ist `FIELD_HELP` in `src/lib/clinics/field-help.ts`. Ein wegen
  fehlender Pflichtfelder gesperrter Veröffentlichungsschalter verwendet stattdessen das Font-
  Awesome-Symbol `triangle-exclamation` mit dem erklärenden Tooltip.
  Pflichtfelder erhalten über die gemeinsame `FieldLabel` ein rotes `*` (rein visuell; der Status
  wird per `aria-required` an das Control gemeldet); die Pflichtmengen stammen aus
  `MEMBER_KEYS`/`PUBLISH_KEYS` (`publish-requirements.ts`). Die Beschreibung der Beratungsarbeit ist
  nur Pflicht, wenn „Berät individuell?" = Nein.
- **Veröffentlichung ist an Vollständigkeit geknüpft.** Eine Clinic wird nur öffentlich (und damit
  für den Chatbot sichtbar), wenn `name`, `website`, `region`, `legal_areas`, `target_clients`,
  `languages` und die Beratungsarbeit-Angabe gesetzt sind — einzige Quelle ist
  `publishBlockers`/`missingRequiredKeys` in `src/lib/clinics/publish-requirements.ts`, genutzt vom
  Admin-Umschalter, der Admin-`PATCH`-Route (422 bei Lücken) und der Auto-Veröffentlichung.
  Mitglieder-Formular und Registrierung erzwingen zusätzlich `contact_email`
  (`clinicMemberSaveSchema`, `clinicSubmissionSchema`). **Beratungsarbeit** ist eine Ja/Nein-Angabe
  (`advises_clients`): „Nein" verlangt einen erklärenden Text zur Alternativleistung — geteilte
  `AdviceField`-Komponente in Formular, Registrierung und Admin-Editor. Auto-Veröffentlichung
  passiert nur bei der **ersten Zugangsaktivierung** (`profiles.activated_at`): über die ursprüngliche
  Einladung oder einen Ersatz-Magic-Link, nie bei späteren Logins, damit ein Admin-„Verbergen" nicht
  aufgehoben wird. Der Admin-Editor rendert jede Zelle passend
  zum Inhalt (E-Mail/URL/Text/Ja-Nein) neben den geführten Vorschlägen. Die Datenbanktabelle scrollt
  in einem eigenen Bereich (`max-h`, `overflow-auto`) mit fixierter Kopfzeile und fixierter
  Namensspalte (`position: sticky`); der Veröffentlichen-Schalter richtet sich stets nach dem
  gespeicherten Eintrag — auch im Bearbeiten-Modus, nicht nach ungespeicherten Entwürfen.
- **Chat-Sprache:** Der Assistent leitet die Sprache der ratsuchenden Person ausschließlich aus der
  Nachrichtensprache ab und stellt dazu keine Rückfrage. Passt eine Clinic inhaltlich, führt aber die
  Sprache nicht auf, wird sie trotzdem empfohlen — mit dem Hinweis, die Sprache direkt zu klären.
  Diese Regeln leben im `chat_skill`-Text (DB `settings`), nicht im Code.
- **Chat-Kontext und Sucherweiterung:** Für die Empfehlung klärt der Assistent Aufenthaltsort,
  ratsuchende Person und rechtliches Anliegen mit höchstens einer Rückfrage pro Nachricht. Den
  Sachverhalt ordnet er allgemeinen, etablierten Rechtsgebieten aus dem aktuellen Verzeichnis zu,
  ohne aus dem Kontext neue enge Rechtsgebietsbezeichnungen zu bilden. Erst wenn die inhaltliche
  Suche keine passende Clinic liefert, sucht er ein zweites Mal mit weiter gefassten Kriterien.
  Geringe und mittlere Zweifel an der Rechtsgebiet-Passung führen zu einer Empfehlung (mittlere mit
  transparentem Prüfhinweis), hohe Zweifel nicht; diese Skala gilt ausschließlich für das
  Rechtsgebiet. Passt kein im Verzeichnis vorhandenes Rechtsgebiet ausreichend, darf der Assistent
  dies nach den vorgeschriebenen Suchen als Kein-Treffer-Ergebnis ausgeben. Diese Regeln leben
  ebenfalls im DB-`chat_skill`.
- **Chat-Stream ist NDJSON, kein Klartext.** `/api/chat` sendet eine JSON-Zeile pro Frame
  (`{"t":"text"}` bzw. `{"t":"clinics"}`, siehe `src/lib/chat/stream-protocol.ts`). Wer den Stream
  liest, muss Teilzeilen puffern — ein Frame kann über zwei Chunks brechen. Unbekannte oder
  ungültige Frames werden übersprungen, damit ein neuer Frame-Typ ältere Clients nicht bricht.
- **Assistententext unterstützt sichere Hervorhebung.** `ChatText` rendert ausschließlich gepaarte
  `**…**`-Marker als Fettschrift; HTML und alle anderen Markdown-Funktionen bleiben normaler Text.
- **Zwei Stufen des Finder-Chats:** `FinderChat` zeigt bis zur ersten Nachricht die Suchkarte
  (unverändert), danach ein bildschirmhohes Panel (`h-[calc(100dvh-var(--nav-h)-1.5rem)]`, Flex-Spalte,
  Nachrichtenliste `min-h-0 flex-1`). Es zieht sich beim Öffnen per `scrollIntoView` unter die
  klebende Navigation (`scroll-mt-[var(--nav-h)]`); Überschrift und Untertitel der Startseite bleiben
  in voller Größe darüber stehen und sind durch Hochscrollen weiter erreichbar. Die Nav-Höhe ist der
  Token `--nav-h` — beide Stellen lesen ihn, nie einen Rohwert.
- **Kosten pro Gespräch im Drawer:** Neben „Rechtsgebiet" und „Treffer" steht die API-Kostenschätzung
  dieses einen Gesprächs, gerechnet aus den auf der Zeile summierten Tokens (`input_tokens`/
  `output_tokens`) und dem Preis des Modells. Sie zeigt vier Nachkommastellen (`formatUsdPrecise`),
  weil ein einzelner Chat weit unter einem Cent liegt. Ist das Modell nicht in `PRICING` hinterlegt,
  steht dort „unbekannt" statt einer erfundenen Null.
- **Abschlusszustände im Chat:** Ein `clinics`-Frame beendet die Unterhaltung erst nach dem
  Streamende und zeigt „Dieser Chat ist abgeschlossen" samt Neustart. Ein `nomatch`-Frame zeigt
  „Keine Law Clinic gefunden", die festen nächsten Schritte und den Link zum Gesamtverzeichnis.
  Ein 429-Limit sperrt Eingabe und Neustart lokal; das Kurzzeitlimit wird nach dem konfigurierten
  Minutenfenster wieder freigegeben, das Tageslimit nicht.
- **Steuerung des Assistenten:** Alle Regler stehen in der Tabelle `settings` und sind unter
  `/admin/assistant` editierbar (Betrieb: Modell, Tokens, Temperatur, An/Aus · Anweisungen: Rolle,
  Ablauf · Darstellung: Begrüßung, max. Empfehlungen). **`settings` ist die einzige Quelle — es gibt
  keinen Code-Fallback.** Die Chat-Route liest sie pro Anfrage (`parseChatSettings`), ein
  Admin-Speichern schreibt jede Zeile per Upsert, und die Änderung gilt sofort für alle Ratsuchenden.
  Rolle, Ablauf und die nicht editierbare Datengrundlage leben nur in der DB
  (`chat_system_prompt`/`chat_skill`/`chat_grounding_policy`); die eingefrorene
  Standardfassung liegt daneben (`chat_system_prompt_default`/`chat_skill_default`) und ist im Tab per
  „Auf Standard zurücksetzen" wiederherstellbar. Beide Texte werden per versionierter
  Supabase-Migration gesät; eine Code-seitige Änderung liefert eine neue Migration aus, die die
  `settings`-Zeilen upsertet — nie per Direkt-SQL. Fehlt ein Pflichtwert oder ist er ungültig, gilt
  der Chat als nicht verfügbar (Hinweis auf der Startseite, Warnung im Admin-Tab) statt auf Code
  zurückzufallen. Die Tool-Beschreibungen und die Toolbox-Referenz fürs Admin-Panel stehen dagegen in
  `src/lib/chat/prompts.ts` (nicht admin-editierbar). Die Begrüßung wird nicht übersetzt und erscheint
  in allen 9 Sprachen wörtlich.
- **Chat-Verfügbarkeit auf der Startseite:** `src/app/page.tsx` prüft serverseitig
  `chat_enabled` + gesetzte Keys und rendert bei „aus"/unkonfiguriert die Hinweiskarte
  `ChatUnavailable` **statt** `FinderChat` — dieselben 503-Bedingungen wie die Chat-Route.
- **Protokolle/Logging:** Der Logger (`src/lib/logger.ts`) schreibt strukturiertes JSON nach
  stdout und – am Server, via `src/instrumentation.ts` – zusätzlich in die admin-only Tabelle
  `public.logs` (RLS wie `conversations`, 7 Tage Aufbewahrung, im Sink `log-store.ts` gekappt).
  Sichtbar und exportierbar unter `/admin/logs`. Logs sind bewusst **PII-frei**: an den Logger nur
  kurze `msg` plus `reason`/IDs übergeben, nie Nachrichten, Klartext-Fehlerbodies, Tokens oder
  Personendaten – denn alles Übergebene landet jetzt 7 Tage in der Datenbank und ist per „Für LLM
  kopieren“ exportierbar.
- **Datenaufbewahrung:** Zwei Stufen halten die regelmäßig anwachsenden Tabellen klein. (1) Der
  detaillierte Chat-**Verlauf** bleibt nur für die neuesten **200** Gespräche gespeichert; ältere
  behalten ihre Statistik, verlieren aber `redacted_transcript` — in Echtzeit in
  `record_conversation` gekappt (die schwere `jsonb`-Spalte, zugleich die einzige heikle). (2) Ein
  tägliches `pg_cron`-Job `prune_expired_data()` löscht alles ab einem Jahr, an Monatsgrenzen
  ausgerichtet: Grenzwert `date_trunc('month', now()) - interval '12 months'` (im Oktober 2027 ist
  Oktober 2026 noch sichtbar, September 2026 nicht mehr). Betroffen: `conversations`, `clinic_events`,
  `claim_requests`. **Ausgenommen:** `logs` (eigene 7-Tage-Regel im Sink), `clinic_submissions`
  (offene Registrierungen bleiben bis zur Admin-Entscheidung) und alle operativen Tabellen (`clinics`,
  `profiles`, `settings`, `branding`, Auth). Das Admin-Dashboard blättert mit dem `MonthStepper`
  monatsweise durch dieses rollierende 12-Monats-Fenster (`src/lib/admin/month-window.ts` als einzige
  Quelle für Grenzen und Monatsbereich).
- **Testbarkeit:** Module nehmen Abhängigkeiten als Parameter (`runChat(deps, …)`,
  `handleChatRequest(request, deps)`); Routen sind dünne Verdrahtung.
- **Portabilität:** Keine hostspezifischen APIs; `output: 'standalone'` und das Dockerfile müssen
  bei jedem Anbieter funktionieren, das Schema bleibt als reines SQL migrierbar.

## Versionierung

Das Projekt folgt [Semantic Versioning 2.0.0](https://semver.org/lang/de/). Alle Änderungen werden
in [`CHANGELOG.md`](CHANGELOG.md) nach dem Format
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/) dokumentiert.

Aktuelle Version: **`0.1.0-alpha.1`** — Vorabversion.

- Vor `1.0.0` gilt keine Kompatibilitätsgarantie: Änderungen können in jeder Version brechen.
- Vorabstufen laufen in der Reihenfolge `alpha` → `beta` → `rc` → stabiles `0.1.0`.
- Version anheben und passenden Tag erzeugen:

  ```bash
  npm version prerelease --preid=alpha   # 0.1.0-alpha.1 → 0.1.0-alpha.2
  npm version prerelease --preid=beta    # Wechsel der Vorabstufe
  npm version minor                      # Vorabphase verlassen → 0.1.0
  ```

- Jede Version erhält einen annotierten Git-Tag im Format `v<version>` sowie einen Eintrag im
  Changelog.
