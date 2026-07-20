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

| Variable                        | Bereich    | Zweck                                            |
| ------------------------------- | ---------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | öffentlich | Supabase-Projekt-URL                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | öffentlich | Anon-Key, spaltenweise per RLS beschränkt        |
| `SUPABASE_SECRET_KEY`           | Server     | Service-Key, umgeht RLS — niemals `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY`             | Server     | Claude API für Chat und Redaktion                |
| `DEV_LOGIN_ENABLED`             | nur Dev    | Schaltet die E-Mail-freien Test-Logins frei      |

`DEV_LOGIN_ENABLED` darf in Produktion nie gesetzt sein. Die zugehörige Route antwortet
zusätzlich mit 404, sobald `NODE_ENV=production` gilt.

## Architektur

Einstiegspunkte: `src/app/layout.tsx` (Root-Layout), `src/proxy.ts` (Rollen-Gating; ersetzt
`middleware.ts` ab Next 16; Matcher `/admin/*`, `/clinic/*`), API-Routen unter `src/app/api/`.

| Pfad                    | Zweck                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| `src/app/page.tsx`      | Öffentliche Startseite mit eingebettetem FinderChat                          |
| `src/app/login/`        | Gemeinsames Login für Clinics und Admins (Magic Link, nur auf Einladung)     |
| `src/app/signup/`       | Selbstregistrierung: Verzeichnis durchsuchen → Eintrag beanspruchen oder neu |
| `src/app/auth/confirm/` | OTP-Verifikation via `token_hash`                                            |
| `src/app/clinic/`       | Clinic-Bereich: ausschließlich den eigenen Eintrag bearbeiten                |
| `src/app/admin/`        | Admin: Dashboard, Clinics-CRUD, Einladungen, Freigaben, Konversationen       |
| `src/app/api/chat/`     | Streamender Claude-Tool-Use-Loop; speichert redigierte Konversationen        |
| `src/app/api/signup/`   | Öffentliche API: Suche, Beanspruchung, Registrierung                         |
| `src/app/api/admin/**`  | Admin-CRUD: Clinics, Einladungen, Einreichungen, Einstellungen               |
| `src/components/ui/`    | UI-Kit: Badge, Button, Card, Checkbox, Input, Modal, Textarea, StageShell    |
| `src/components/chat/`  | FinderChat (Suchkarte → Chat) plus die Empfehlungskarten                     |
| `src/lib/chat/`         | Schema, beide Tools, NDJSON-Stream-Protokoll, Loop, Redaktion, Persistenz    |
| `src/lib/i18n/`         | Wörterbücher für 9 Sprachen, `lcf_lang`-Cookie, RTL-Hilfen                   |
| `src/lib/signup/`       | Verzeichnissuche, E-Mail-Maskierung, Beanspruchungsfenster, Registrierung    |
| `src/lib/supabase/`     | Clients: Browser, Server (Cookies), Service (nur Server), Proxy-Session      |
| `src/lib/auth/`         | `requireRole` (+ `AuthError`), Admin-Guard für API-Routen                    |
| `src/lib/`              | Logger (strukturiertes JSON), Rate-Limiting, Einstellungen, `cn`, Schemata   |
| `supabase/migrations/`  | Schema und RLS — alleinige Quelle der Wahrheit                               |
| `scripts/`              | Zod-validierter Clinic-Import, Dev-Hilfsskripte                              |

**Datenfluss:** Browser → API-Route (Zod-Validierung, `requireRole`) → Supabase (Postgres + RLS)
→ Antwort. Beim Chat streamt `/api/chat` die Antwort erst nach Rate-Limit- und Einstellungsprüfung;
nach Streamende redigiert `after()` das Transkript (Regex-Vorlauf plus Modellaufruf, Zod-validiert)
und legt es mit Kennzahlen ab.

**Chat-Werkzeuge:** Das Modell hat zwei Tools. `search_clinics` liest das Verzeichnis (ohne Filter
das ganze, damit das Modell selbst darin suchen kann; lange Freitextfelder werden pro Zeile
gekürzt). `recommend_clinics` nimmt die ausgewählten Clinics samt Begründung entgegen — der Server
schlägt jeden Namen in der Datenbank nach und sendet daraus die Karten. Alles außer der Begründung
stammt damit aus der Datenbank, und ein erfundener Name fällt heraus, statt als echte Empfehlung
beim Ratsuchenden zu landen.

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
- **Chat-Stream ist NDJSON, kein Klartext.** `/api/chat` sendet eine JSON-Zeile pro Frame
  (`{"t":"text"}` bzw. `{"t":"clinics"}`, siehe `src/lib/chat/stream-protocol.ts`). Wer den Stream
  liest, muss Teilzeilen puffern — ein Frame kann über zwei Chunks brechen. Unbekannte oder
  ungültige Frames werden übersprungen, damit ein neuer Frame-Typ ältere Clients nicht bricht.
- **Steuerung des Assistenten:** Modell, Antwortlänge, An/Aus und System-Prompt stehen in der
  Tabelle `settings` und sind unter `/admin/settings` editierbar; fehlt eine Zeile, greift
  `DEFAULT_CHAT_SETTINGS` in `src/lib/settings.ts`. Der Prompt steuert den Gesprächsablauf, die
  Tool-Beschreibungen in `run-chat.ts` steuern, wann welches Tool gezogen wird — beides gehört
  zusammen geändert.
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
