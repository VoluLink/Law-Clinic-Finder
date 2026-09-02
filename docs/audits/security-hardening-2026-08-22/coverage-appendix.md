# Prüfumfang und bestätigte Fehlalarme

Was tatsächlich angesehen wurde, mit welchem Verfahren, und was sich bei der Nachprüfung am
Quelltext **nicht** bestätigt hat. Fehlalarme stehen hier, statt stillschweigend zu verschwinden —
sonst prüft die nächste Runde dieselbe Stelle noch einmal.

Umfang: 633 versionierte Dateien. 1553 Tests, davon 1524 grün und 29 übersprungen, weil sie
Emulatoren brauchen.

---

## 1 — Vollständig durchgesehen

| Gruppe                                                                | Verfahren                                                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Alle 26 `src/app/api/**/route.ts` und `src/app/auth/signout/route.ts` | Datei für Datei: Wache, Same-Origin, Grenze, Body-Prüfung, Schema, Fehlerform                  |
| Auth, Session, Origin, Profil, Signup, Admin-Zugriffskontrolle        | Datei für Datei                                                                                |
| Firestore- und Storage-Regeln, Indizes                                | Gelesen und gegen die Regeltests gehalten                                                      |
| `functions/`                                                          | Gelesen; Tests und Build laufen                                                                |
| Ausgehende Netzwerkaufrufe                                            | Erschöpfende Suche nach `fetch(`, `createTransport`, `new URL(` und literalen Hosts — siehe §3 |
| Renderpfad des Chats                                                  | Alle DOM-, URL- und Storage-Senken durchsucht — siehe §4                                       |
| Docker, App Hosting, CI, Dependabot                                   | Gelesen — siehe §5                                                                             |
| Skripte in `scripts/`                                                 | Auf PII, Sekrete und Supabase-Reste durchgesehen — siehe §6                                    |

---

## 2 — Server- und Client-Grenzen

Verfahren: 31 Client-Komponenten und 21 Server-Seiten; für jede DTO-Grenze geprüft, ob mehr über die
Grenze geht als die Ansicht braucht.

**Befund:** keiner. `src/app/admin/clinics/page.tsx` reicht `contact_email` an eine
Client-Komponente weiter, liegt aber hinter `requireRole(['admin'])` — sowohl im Layout als auch
noch einmal in der Seite selbst — und die Adresse ist genau das, was eine Administratorin dort
braucht.

Der öffentliche DTO `PublicClinic` führt **keine** Kontaktadresse; nur `RecommendationClinic`
erweitert ihn um `contact_email`, und das ist die Adresse, die eine Clinic bewusst veröffentlicht.

---

## 3 — Ausgehende Ziele

| Ziel                      | Ergebnis                                                                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SMTP (admin-konfiguriert) | **Befund, behoben** (`6073bc3`)                                                                                                                                                                                                                                            |
| Secret Manager            | **Befund, behoben** (`9bd466c`) — `SMTP_SETTINGS_SECRET_LOCATION` bestimmte ungeprüft den Host                                                                                                                                                                             |
| Cloud DLP                 | **Befund, behoben** (`9bd466c`) — `DLP_LOCATION` und `FIREBASE_PROJECT_ID` gingen ungeprüft in den Pfad                                                                                                                                                                    |
| Identity Toolkit          | **Fehlalarm.** Basis fest auf HTTPS; die Emulator-Ausnahme braucht eine strikte Loopback-Regex **und** `NODE_ENV !== 'production'`. Der Pfad ist ein Literal.                                                                                                              |
| GA Data API               | **Fehlalarm.** Fester Host, Property-ID auf `^\d{1,20}$` beschränkt.                                                                                                                                                                                                       |
| Branding-Schrift-URL      | **Fehlalarm zum Zeitpunkt der Prüfung** — Allow-Liste. Inzwischen ganz entfallen (`18569b8`).                                                                                                                                                                              |
| Branding-CSS-Variablen    | **Fehlalarm.** Sah nach CSS-Injection in den Nonce-Style-Block aus. `brandingSchema` erzwingt aber ein `z.enum` für die Familie und Hex für alle vier Farben, und der Lesepfad parst über dasselbe Schema; scheitert das, fällt die Seite auf die Voreinstellungen zurück. |
| Cloudflare Turnstile      | Feste Verify-URL, Sekret serverseitig.                                                                                                                                                                                                                                     |
| Firebase Storage (Logo)   | URL serverseitig aus dem gepinnten Bucket-Namen und einem selbst vergebenen Pfad gebaut.                                                                                                                                                                                   |

---

## 4 — Render- und DOM-Senken

Erschöpfende Suche nach `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval`,
`new Function`, `localStorage`, `sessionStorage`, `window.location`, `postMessage`,
`URL.createObjectURL` und `target="_blank"`.

| Stelle                                        | Ergebnis                                                                                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/layout.tsx` — Nonce-Style-Block      | Einziges `dangerouslySetInnerHTML`. Inhalt ausschließlich aus validierten Werten: Hex-Farben, `z.enum`-Familie, generierte Faces.                                                                      |
| Clinic-Karte im Chat                          | **Befund, behoben** (`ab284d8`)                                                                                                                                                                        |
| `ConfirmLink.tsx` — `window.location.replace` | **Fehlalarm.** Sah nach offener Weiterleitung aus; `confirmationDestinationSchema` ist ein geschlossenes `z.enum` aus sechs relativen Pfaden, geprüft beim Parsen der Antwort **und** im Typ.          |
| `ConversationsPanel.tsx` — Website im Verlauf | **Fehlalarm.** Sah nach einer ungeprüften URL aus dem Verlauf aus; `loadRecommendedClinics` parst über `clinicDocumentSchema`, das seit `ab284d8` ein unbrauchbares Schema auf `null` setzt.           |
| `ClinicsManager.tsx` — Website in der Tabelle | **Kleiner Befund, behoben.** `rel="noopener"` ohne `noreferrer` — die einzige Ausnahme unter acht Links mit `target="_blank"`. Damit ging der Referer einer angemeldeten Admin-Seite an fremde Server. |
| `localStorage` / `sessionStorage`             | Wird nirgends benutzt.                                                                                                                                                                                 |

---

## 5 — Build, Auslieferung, Lieferkette

| Prüfung                      | Ergebnis                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI-Schritte                  | typecheck, Tests (beide Bäume), lint, format, build, Scan der Build-Ausgabe, `npm audit --omit=dev --audit-level=high` je Baum                                                                                      |
| Berechtigungen des Workflows | `contents: read` — sonst nichts                                                                                                                                                                                     |
| Action-Pinning               | Beide auf einen Commit-SHA gepinnt, gegen die GitHub-API als `v4.4.0` bestätigt                                                                                                                                     |
| Dependabot                   | npm im Wurzelverzeichnis, npm in `functions/`, github-actions — wöchentlich                                                                                                                                         |
| Dockerfile                   | Nicht-Root (`USER nextjs`), mehrstufig, `--chown`. **Nicht** auf dem Deploy-Pfad: App Hosting baut aus dem Quelltext, und kein Dokument verwies auf das Dockerfile. Nach der Prüfung samt `.dockerignore` entfernt. |
| `npm audit`                  | Ein Restbefund: `uuid < 11.1.1`, transitiv über `firebase-admin`. Kein `overrides`, kein `--force` — der vorgeschlagene „Fix" ist ein Downgrade auf `firebase-admin` 10.3.0.                                        |

---

## 6 — Skripte, Entwicklungspfade, Supabase-Reste

| Prüfung                    | Ergebnis                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase zur Laufzeit      | Zum Prüfzeitpunkt erschien `@supabase/supabase-js` ausschließlich unter `scripts/firebase-migration/`; keine Datei unter `src/` importierte es. Die gesamte Supabase-Schicht wurde nach der Prüfung entfernt.                  |
| `/api/dev/login`           | Antwortet mit **404**, sobald `parseDevLoginRole` null liefert — in Produktion und ohne Opt-in-Flag immer. Verlangt zusätzlich Emulatoren auf Loopback, kann also keine privilegierten Konten in einem echten Projekt anlegen. |
| Test- und Seed-Identitäten | Nur `@example.com` und `@example.org`. Die beiden echten `@example.com`-Konten im Live-Projekt sind kein Repository-Problem, stehen aber unter „Offene Punkte" in `README.md`.                                                 |
| `.env` in der Historie     | `git ls-files                                                                                                                                                                                                                  | grep -i env`und`git log --all -- '*.env'`: nur `.env.example`. |

---

## 7 — Testabdeckung der Kontrollen

Stichprobe pro Kontrolle: Gibt es einen Test, der fehlschlägt, wenn die Kontrolle entfernt wird?

| Kontrolle                     | Negativ-, Missbrauchs- oder Wettlauftest                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body-Grenzen                  | Ja — Wirksamkeit belegt, indem die Login-Route testweise auf `request.json()` zurückgesetzt wurde: zwei Tests fielen, nach dem Zurücksetzen wieder grün |
| Fail-closed-De-Identifikation | Ja — Timeout, 403, 400, defekter Body, unbrauchbare Region: jeweils 503, kein Anthropic-Aufruf, kein Kontingent verbraucht                              |
| Ort und Postleitzahl          | Ja — ein Stub, der einen Ort entfernt, muss `{ ok: false }` erzeugen, nicht eine redigierte Nachricht                                                   |
| Rate-Limiter-Verdrängung      | Ja — Verdrängung nach Nutzung, `maxKeys: 0` abgewiesen                                                                                                  |
| Dauerhafte Grenzen            | Ja — gegen den Emulator: zwei gleichzeitige Versuche um den letzten Platz, genau einer gewinnt                                                          |
| Adressnachweis vor Freigabe   | Ja — bestätigt, unbestätigt, fehlend, Wettlauf                                                                                                          |
| Erneute Anmeldung             | Ja — abgelaufene `authTime` ergibt 401 mit `reauth_required`                                                                                            |
| Prompt-Injection              | Ja — Verzeichnistext und Renderpfad, einschließlich zweier im Assistententext gefälschter Frames                                                        |
| SSRF im SMTP-Ziel             | Ja — IPv4, IPv6, gemischte Antworten, Rebinding, Timeout, öffentlicher Host; zusätzlich mit 13 eigenen Fällen unabhängig nachgeprüft                    |
| CSP ohne externe Quellen      | Ja — der Test benennt, warum eine wieder hinzugefügte Ausnahme eine Datenschutzregression wäre                                                          |
| Log-Maskierung                | Ja — und Gegenprobe: `statusCode`, `keyword`, `monkeyPatch`, `sessionsPerDay`, `authorName` bleiben lesbar                                              |

---

## 8 — Nicht geprüft

Ehrlichkeitshalber:

- **Der Docker-Image-Build.** In dieser Umgebung ist kein Docker verfügbar. Die `.dockerignore`
  wurde deshalb konservativ auf Pfade begrenzt, die der Next.js-Build nachweislich nicht liest.
- **Alles Ausgerollte.** IAM, TTL, Indizes, Backups, Identity-Platform-Einstellungen: nur die Cloud
  weiß das. Kommandos in [operational-verification.md](operational-verification.md), keines
  ausgeführt.
- **Der visuelle Abgleich des PDFs** gegen die gelieferte Designvorlage. Schriftwahl, Zeilenumbruch
  und Sprachauswahl sind getestet; ob die Seite aussieht wie die Vorlage, kann nur jemand sagen, der
  beide nebeneinander sieht.
- **Die Kapitelnummern von ASVS und AISVS** wurden nicht gegen die Originaltexte abgeglichen — die
  Matrix geht über die Kapiteltitel.
