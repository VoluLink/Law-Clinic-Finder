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
| `ANTHROPIC_API_KEY`             | Server     | Claude API für Chat und Redaktion                         |
| `DEV_LOGIN_ENABLED`             | nur Dev    | Schaltet die E-Mail-freien Test-Logins frei               |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | öffentlich | GA4-Mess-ID; aktiviert einwilligungsbasiertes Tracking    |
| `GA_PROPERTY_ID`                | Server     | GA4-Property für die Dashboard-Kennzahlen (Data API)      |
| `GA_SERVICE_ACCOUNT_JSON`       | Server     | Service-Account für die GA Data API (Dashboard-GA-Karten) |

`DEV_LOGIN_ENABLED` darf in Produktion nie gesetzt sein. Die zugehörige Route antwortet
zusätzlich mit 404, sobald `NODE_ENV=production` gilt.

## Architektur

Einstiegspunkte: `src/app/layout.tsx` (Root-Layout), `src/proxy.ts` (Rollen-Gating; ersetzt
`middleware.ts` ab Next 16; Matcher `/admin/*`, `/clinic/*`), API-Routen unter `src/app/api/`.

| Pfad                         | Zweck                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/page.tsx`           | Öffentliche Startseite mit eingebettetem FinderChat                                                                                           |
| `src/app/login/`             | Gemeinsames Login für Clinics und Admins (Magic Link, nur auf Einladung)                                                                      |
| `src/app/signup/`            | Selbstregistrierung: Verzeichnis durchsuchen → Eintrag beanspruchen oder neu                                                                  |
| `src/app/auth/confirm/`      | OTP-Verifikation via `token_hash`                                                                                                             |
| `src/app/clinic/`            | Clinic-Bereich (Teal-Sidebar-Shell): Mein Eintrag, Statistiken (Empfehlungen/Klicks), Konto (Selbst-Löschung)                                 |
| `src/app/admin/`             | Admin: Teal-Sidebar-Shell — Dashboard (Statistik + Gespräche-Drawer), Law Clinics, KI-Assistent, Protokolle, Branding, Konto                  |
| `src/app/api/chat/`          | Streamender Claude-Tool-Use-Loop; speichert redigierte Konversationen + Empfehlungs-Events                                                    |
| `src/app/api/clinic/`        | Clinic-Self-Service: eigenen Eintrag bearbeiten (`PATCH`), Konto löschen (`DELETE /account`: unpublish + Login weg)                           |
| `src/app/api/clinic-events/` | Öffentlicher Klick-Beacon (Website/E-Mail); same-origin, rate-limitiert, nur veröffentlichte Clinics, PII-frei                                |
| `src/app/api/signup/`        | Öffentliche API: Suche, Beanspruchung, Registrierung                                                                                          |
| `src/app/api/admin/**`       | Admin-CRUD: Clinics, Einladungen, Zugang-Entzug, Einreichungen, Einstellungen, Branding, Protokolle                                           |
| `src/components/ui/`         | UI-Kit: Badge, Button, Card, Checkbox, ColorField, Drawer, FileDropzone, Input, Modal, Panel, Select, StatCard, BarChart, MeterList, Textarea |
| `src/lib/branding/`          | Branding-Record laden/validieren; Runtime-Theming (`:root`-Tokens + Google-Font) im Root-Layout                                               |
| `src/lib/analytics/`         | GA4-Consent (Mode v2) + Data-API-Kennzahlen (`ga-metrics.ts`, leer bis konfiguriert)                                                          |
| `src/components/analytics/`  | GA-Script (einwilligungsgesteuert) + Cookie-Consent-Banner                                                                                    |
| `src/components/admin/`      | AdminChrome: Admin-Navigation auf Basis der geteilten `PortalShell`                                                                           |
| `src/components/layout/`     | Wordmark, AreaHeader, `PortalShell` (geteilte Teal-Sidebar für Admin- **und** Clinic-Portal, aktive Tabs via `usePathname`)                   |
| `src/components/chat/`       | FinderChat (Suchkarte → Chat) plus die Empfehlungskarten (Klick-Beacon auf Website/E-Mail)                                                    |
| `src/lib/chat/`              | `prompts.ts` (Modelltexte), Schema, Tools, NDJSON, Loop, Redaktion, `usage.ts` (Token/Kosten pro Gespräch)                                    |
| `src/lib/clinic/`            | `stats.ts`: Kennzahlen des Statistik-Tabs (Empfehlungen, Klicks, Klickrate)                                                                   |
| `src/lib/clinics/`           | `revoke-access.ts` (Login löschen ± unpublish), `click-event.ts` (Klick-Recorder), `schema.ts`                                                |
| `src/lib/logs/`              | `log-store.ts`: Sink, der Logs in `public.logs` schreibt (7 Tage Aufbewahrung)                                                                |
| `src/instrumentation.ts`     | Next-Startup-Hook: verbindet den Logger mit dem `logs`-Sink                                                                                   |
| `src/lib/i18n/`              | Wörterbücher für 9 Sprachen, `lcf_lang`-Cookie, RTL-Hilfen                                                                                    |
| `src/lib/signup/`            | Verzeichnissuche, E-Mail-Maskierung, Beanspruchungsfenster, Registrierung                                                                     |
| `src/lib/supabase/`          | Clients: Browser, Server (Cookies), Service (nur Server), Proxy-Session                                                                       |
| `src/lib/auth/`              | `requireRole` (+ `AuthError`), Admin-Guard für API-Routen                                                                                     |
| `src/lib/`                   | Logger (strukturiertes JSON, optional in `logs`-Tabelle), Rate-Limiting, Einstellungen, `cn`, Schemata                                        |
| `supabase/migrations/`       | Schema und RLS — alleinige Quelle der Wahrheit                                                                                                |
| `scripts/`                   | Zod-validierter Clinic-Import, Dev-Hilfsskripte                                                                                               |

**Datenfluss:** Browser → API-Route (Zod-Validierung, `requireRole`) → Supabase (Postgres + RLS)
→ Antwort. Beim Chat streamt `/api/chat` die Antwort erst nach Rate-Limit- und Einstellungsprüfung;
nach Streamende redigiert `after()` das Transkript (Regex-Vorlauf plus Modellaufruf, Zod-validiert)
und legt es mit Kennzahlen ab.

**Privatsphäre im Chat:** E-Mail-Adressen und Telefonnummern werden per Regex (`redactPatterns`)
schon **vor** dem Anthropic-Aufruf entfernt — das Modell bekommt sie nie zu sehen, nicht erst die
Datenbank. Namen und Anschriften bleiben im Text (das Modell braucht die Schilderung); sie werden
erst beim Speichern vom Redaktionsmodell entfernt. Es ist also eine _teilweise_ Anonymisierung
vor dem Modell, keine vollständige.

**Chat-Werkzeuge:** Das Modell hat zwei Tools. `search_clinics` liest das Verzeichnis (ohne Filter
das ganze, damit das Modell selbst darin suchen kann; lange Freitextfelder werden pro Zeile
gekürzt). `recommend_clinics` nimmt die ausgewählten Clinics samt Begründung entgegen — der Server
schlägt jeden Namen in der Datenbank nach und sendet daraus die Karten. Alles außer der Begründung
stammt damit aus der Datenbank, und ein erfundener Name fällt heraus, statt als echte Empfehlung
beim Ratsuchenden zu landen.

**Pro-Clinic-Statistik:** Jede Empfehlung schreibt beim Speichern des Gesprächs ein
`recommended`-Event nach `public.clinic_events`; Klicks auf Website/E-Mail meldet ein Beacon der
Empfehlungskarte an `/api/clinic-events` (`click_website`/`click_email`). Die Events tragen **keine**
Nutzerdaten (nur Clinic-ID, Art, Zeitstempel). Der Statistik-Tab der Clinic liest sie über die View
`clinic_event_counts` (`security_invoker`, RLS auf `private.app_clinic_id()`) — **nur die eigenen
Zahlen, nicht für Admins**. Löscht ein Gespräch (DSGVO), bleibt der Zähler erhalten
(`conversation_id … on delete set null`).

**System-Prompt = Rolle + Ablauf:** Der System-Prompt wird zur Laufzeit aus zwei Texten
zusammengesetzt (`buildSystemPrompt` in `src/lib/chat/prompts.ts`): `<role>` (wer der Assistent
ist, feste Grenzen) und `<skill>` (der nummerierte Gesprächsablauf). Beide sind unter
`/admin/assistant` editierbar. `prompts.ts` ist die einzige Datei mit modell-sichtbarem Text —
auch die Tool-Beschreibungen und der Redaktions-Prompt stehen dort.

**Grenzwerte des Chats** (Konstante → Datei → Wert):

| Grenze                  | Datei           | Wert            |
| ----------------------- | --------------- | --------------- |
| Anfragen/Minute pro IP  | `rate-limit.ts` | 20              |
| Anfragen/Tag pro IP     | `rate-limit.ts` | 20              |
| `max_tokens` (Standard) | `settings.ts`   | 1024 (max 4096) |
| Temperatur (Standard)   | `settings.ts`   | 0.3             |
| Tool-Runden pro Antwort | `run-chat.ts`   | 5 (→ 6 Aufrufe) |
| Zeichen pro Nachricht   | `schema.ts`     | 4000            |
| Nachrichten im Verlauf  | `schema.ts`     | 16              |
| Empfohlene Clinics      | `settings.ts`   | ≤ 8 (Standard)  |

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
- **Datenbank-Rechte:** `anon` erhält ausschließlich spaltenweise Grants, nie tabellenweite — ein
  Table-Grant hebt spaltenweise Revokes stillschweigend auf. `clinics.contact_email` ist für `anon`
  bewusst nicht lesbar; alles, was die Adresse braucht, läuft über den Service-Client. Vor jeder
  neuen Spalte mit Personenbezug den `anon`-Grant in derselben Migration festlegen.
- **Clinic-Selbstverwaltung:** „Konto löschen“ entfernt den Login **und** setzt `is_published=false`,
  lässt den Verzeichnis-Eintrag aber bestehen — geteilte Logik `revokeClinicAccess(admin, id,
{ unpublish })`, die auch der Admin-Zugang-Entzug nutzt (`unpublish: false`, Eintrag bleibt
  sichtbar). Der Admin-Filter „Mit Konto verknüpft“ zeigt Einträge mit Mitglieds-Login (aktiv oder
  eingeladen); „Alle“ behält ausgeblendete/selbstgelöschte Einträge.
- **Chat-Stream ist NDJSON, kein Klartext.** `/api/chat` sendet eine JSON-Zeile pro Frame
  (`{"t":"text"}` bzw. `{"t":"clinics"}`, siehe `src/lib/chat/stream-protocol.ts`). Wer den Stream
  liest, muss Teilzeilen puffern — ein Frame kann über zwei Chunks brechen. Unbekannte oder
  ungültige Frames werden übersprungen, damit ein neuer Frame-Typ ältere Clients nicht bricht.
- **Steuerung des Assistenten:** Alle Regler stehen in der Tabelle `settings` und sind unter
  `/admin/assistant` editierbar (Betrieb: Modell, Tokens, Temperatur, An/Aus · Anweisungen: Rolle,
  Ablauf · Darstellung: Begrüßung, max. Empfehlungen). Fehlt eine Zeile, greift
  `DEFAULT_CHAT_SETTINGS` in `src/lib/settings.ts` — die Tabelle ist anfangs leer, der erste
  Speichervorgang legt die Zeilen an. Rolle und Ablauf steuern das Gespräch, die Tool-Beschreibungen
  in `prompts.ts` steuern, wann welches Tool gezogen wird — beides gehört zusammen geändert. Die
  Begrüßung wird nicht übersetzt und erscheint in allen 9 Sprachen wörtlich.
- **Protokolle/Logging:** Der Logger (`src/lib/logger.ts`) schreibt strukturiertes JSON nach
  stdout und – am Server, via `src/instrumentation.ts` – zusätzlich in die admin-only Tabelle
  `public.logs` (RLS wie `conversations`, 7 Tage Aufbewahrung, im Sink `log-store.ts` gekappt).
  Sichtbar und exportierbar unter `/admin/logs`. Logs sind bewusst **PII-frei**: an den Logger nur
  kurze `msg` plus `reason`/IDs übergeben, nie Nachrichten, Klartext-Fehlerbodies, Tokens oder
  Personendaten – denn alles Übergebene landet jetzt 7 Tage in der Datenbank und ist per „Für LLM
  kopieren“ exportierbar.
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
