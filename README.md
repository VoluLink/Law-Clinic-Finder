# Law Clinic Finder

## What & Run

Mehrsprachiger Finder für studentische Rechtsberatung mit öffentlichem KI-Chat, Clinic-Portal und
Admin-Bereich. Diese Fassung ersetzt Supabase vollständig durch Firebase Authentication mit
Identity Platform, Cloud Firestore, Cloud Storage und Firebase App Hosting. Auth-Mails werden über
einen provider-neutralen SMTP-Adapter versendet; Brevo ist nur die aktuelle Konfiguration.

Stack: Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS v4 · Firebase Admin · Firestore ·
Anthropic · Nodemailer. Benötigt Node 22.

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

Wichtige Befehle:

| Befehl                                                          | Zweck                                                                |
| --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `npm run emulators`                                             | Auth-, Firestore-, Functions- und Storage-Emulatoren                 |
| `npm run test:firebase`                                         | Firestore-Transaktionen und Race-Bedingungen gegen den Emulator      |
| `npm run test:rules`                                            | Deny-by-default-Regeln gegen Emulatoren prüfen                       |
| `npm run test:migration`                                        | Firebase-Ziel: Apply, Resume und Verify gegen Emulatoren             |
| `npm run test:e2e`                                              | Rollen-, Public-, RTL- und Accessibility-E2E nur gegen Emulatoren    |
| `npm run dev:login:teardown`                                    | Löscht nur die zwei `@example.com`-Konten aus Loopback-Emulatoren    |
| `npm run import:clinics -- clinics.json`                        | Clinic-JSON validieren; ohne `--apply` nur Vorschau                  |
| `npm run migrate:firebase -- --source-ref <REF> --run-id <RUN>` | Supabase lesen, validieren und Checksummen ausgeben; schreibt nichts |

Die Emulator-Hosts müssen beim lokalen App-Prozess auf Loopback zeigen:

```bash
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
DEV_LOGIN_ENABLED=true
```

### Umgebung

Reale Werte gehören ausschließlich in `.env.local` bzw. App Hosting Secret Manager, nie ins Repo.
`.env.example` enthält die vollständige Vorlage.

| Variable                                                 | Sichtbarkeit          | Zweck                                                                                                          |
| -------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`                                    | Server                | Fest auf `law-clinic-finder`; verhindert versehentliche Zielwechsel                                            |
| `FIREBASE_DATABASE_ID`                                   | Server                | Fest auf die benannte EU-Datenbank `primary-eu`                                                                |
| `FIREBASE_STORAGE_BUCKET`                                | Server                | Branding-Bucket des Projekts                                                                                   |
| `IDENTITY_PLATFORM_API_KEY`                              | Server, nicht geheim  | Identity-Platform-REST-Austausch für E-Mail-Links                                                              |
| `NEXT_PUBLIC_SITE_URL`                                   | öffentlich            | Kanonischer HTTPS-Origin für `/auth/confirm`                                                                   |
| `SMTP_HOST` / `SMTP_PORT`                                | Server                | SMTP-Server und Port; 465 = TLS, andere Ports = STARTTLS                                                       |
| `SMTP_LOGIN_EMAIL` / `SMTP_PASSWORD`                     | Server/Secret         | Provider-neutraler SMTP-Login                                                                                  |
| `SMTP_FROM_EMAIL` / `SMTP_FROM_NAME`                     | Server                | Absender; E-Mail fällt auf den SMTP-Login zurück                                                               |
| `SMTP_SETTINGS_SECRET` / `SMTP_SETTINGS_SECRET_LOCATION` | Server                | Name und Region des versionierten SMTP-Secrets, das der Admin-Bereich schreibt; leere Region = globales Secret |
| `STAGING_ACCESS_ENABLED`                                 | Server                | Schaltet den temporären Vorschau-Schutz explizit ein                                                           |
| `STAGING_ACCESS_USERNAME` / `STAGING_ACCESS_PASSWORD`    | Server/Secret         | HTTP-Basic-Zugang; Passwort nur aus Secret Manager                                                             |
| `ANTHROPIC_API_KEY`                                      | Server/Secret         | Claude API für den Finder-Chat                                                                                 |
| `DEV_LOGIN_ENABLED`                                      | nur lokal             | Test-Login, zusätzlich an Auth- und Firestore-Emulator gebunden                                                |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`                          | öffentlich, optional  | Consent-gesteuertes GA4; ohne diesen Wert erscheint auch kein Cookie-Banner                                    |
| `CHALLENGE_ENABLED` / `CHALLENGE_PROVIDER`               | Server                | Missbrauchs-Challenge vor der ersten Chatnachricht; `pow` (Standard) oder `turnstile`                          |
| `CHALLENGE_POW_DIFFICULTY` / `TURNSTILE_SECRET`          | Server/Secret         | Schwierigkeit des Proof-of-Work bzw. Cloudflare-Turnstile-Secret                                               |
| `NEXT_PUBLIC_CHALLENGE_PROVIDER` / `…_POW_DIFFICULTY`    | öffentlich            | Spiegel für den Browser; der Server bleibt die Autorität                                                       |
| `TRUSTED_PROXY`                                          | Server                | `cloudflare` nur, wenn der Origin auf Cloudflare beschränkt ist — sonst sind alle Per-IP-Limits fälschbar      |
| `LOG_PERSIST_LEVEL`                                      | Server, optional      | Niedrigstes Level, das nach Firestore geschrieben wird; Standard `warn`                                        |
| `GA_PROPERTY_ID` / `GA_SERVICE_ACCOUNT_JSON`             | Server, optional      | GA-Karten im Admin-Dashboard                                                                                   |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY`       | nur Migrationsrechner | Read-only Quelle des Kopierwerkzeugs; kein App-Runtime-Zugriff                                                 |

App Hosting stellt Application Default Credentials bereit. Lokal werden Emulatoren oder lokale ADC
außerhalb des Repositories verwendet; Service-Account-JSON wird weder eingebaut noch committed.

## Architecture Map

Einstiegspunkte sind `src/app/layout.tsx`, `src/app/page.tsx`, `src/proxy.ts` und die Route Handler
unter `src/app/api/`. `proxy.ts` macht nur frühes Routing; jede geschützte Datenoperation prüft die
Firebase-Session und das aktuelle Profil erneut.

| Pfad                                              | Zweck                                                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/login/`, `src/app/auth/confirm/`         | Passwortlose Firebase-Anmeldung, E-Mail-Aktion und Session-Cookie                                                                                     |
| `src/app/signup/`                                 | Eintrag beanspruchen, Übernahme beantragen oder neue Clinic registrieren                                                                              |
| `src/app/clinic/`                                 | Eigener Eintrag, rollierende Statistik, Pending-Status und Kontolöschung                                                                              |
| `src/app/admin/`                                  | Dashboard, Clinics/Freigaben, Admins, KI-Einstellungen, Logs, Branding, E-Mail-Versand und Konto                                                      |
| `src/app/api/chat/`                               | Streamender Anthropic-Tool-Loop mit NDJSON hinter der DLP-De-Identifikation                                                                           |
| `src/app/api/admin/**`                            | Rollenprüfende Admin-Workflows; alle Inputs Zod-validiert                                                                                             |
| `src/app/api/clinic/**`                           | Clinic-Self-Service; Clinic-ID stammt ausschließlich aus dem aktiven Profil                                                                           |
| `src/app/api/signup/**`                           | Rate-limitierte öffentliche Suche, Claim und Registrierung                                                                                            |
| `src/components/ui/`                              | Gemeinsames UI-Kit und Varianten                                                                                                                      |
| `src/components/chat/`                            | Finder-Chat, Zustände, Empfehlungskarten und lokaler PDF-/Text-Export                                                                                 |
| `src/lib/auth/`                                   | E-Mail-Link-State, Identity-Toolkit-Austausch und verifizierter E-Mail-Wechsel                                                                        |
| `src/lib/firebase/`                               | Server-only Admin SDK, Dokument-Codecs und Firestore-Repositories                                                                                     |
| `src/lib/http/`                                   | Client-IP, Origin, Request-ID, Idempotenzschlüssel, Body-Grenzen, URL-Schema-Prüfung und zentrale HTTP-Sicherheitsheader                              |
| `src/lib/security/`                               | Cloud-DLP-De-Identifikation, dauerhafte Missbrauchsfenster und Missbrauchs-Challenge (Proof-of-Work oder Cloudflare Turnstile)                        |
| `src/lib/google/`                                 | Namensregeln für Google-Cloud-Ressourcen, die in eine Request-URL einfließen                                                                          |
| `src/lib/text/`                                   | Entfernen unsichtbarer Steuerzeichen — je nach Ziel mit oder ohne die für Farsi/Arabisch nötigen Zeichen                                              |
| `public/fonts/`, `src/lib/branding/font-faces.ts` | Selbst gehostete Branding-Schriften; `npm run branding:fonts` erneuert beides                                                                         |
| `src/lib/clinics/visibility.ts`                   | Selbstverwaltete Sichtbarkeit einer Clinic: sichtbar, befristet oder unbefristet ausgeblendet                                                         |
| `src/components/chat/pdf-layout.ts`               | Reine, testbare Seitenberechnung des Empfehlungs-PDFs; `recommendation-pdf.ts` zeichnet sie als Vektoren                                              |
| `scripts/update-chat-guidance.ts`                 | Idempotente Datenänderung am Ablauf in `settings/chat`; Vorschau ohne `--apply`                                                                       |
| `src/lib/mail/`                                   | Provider-neutraler Transport mit geprüftem Ziel, SMTP-Konfiguration aus Secret Manager, gemeinsame Mailvorlage sowie Auth- und Benachrichtigungsmails |
| `src/lib/chat/`                                   | Chat-Schema, Tools, Quota, Persistenz-Ports, Transkript-Fakten und Tokenkosten                                                                        |
| `src/lib/clinics/`, `src/lib/signup/`             | Clinic-Schemata, Suchvokabular, Veröffentlichung, Signup-Logik                                                                                        |
| `functions/`                                      | Kontoerstellungs-Blocker und günstiger, ereignisgesteuerter Betriebsalarm-Sync                                                                        |
| `firestore.rules`, `storage.rules`                | Browserzugriff: Firestore komplett gesperrt, Storage nur Branding-Lesezugriff                                                                         |
| `firestore.indexes.json`                          | Minimale Query-Indizes und TTL-/Index-Ausnahmen                                                                                                       |
| `scripts/firebase-migration/`                     | Read-only Supabase-Quelle, Transformation, idempotenter Firebase-Writer und Verify                                                                    |
| `docs/firebase-migration-plan.md`                 | Nur noch offene Migrations-, Cutover- und Folgearbeiten                                                                                               |
| `docs/audits/security-hardening-2026-08-22/`      | Sicherheitsbericht, ASVS-/AISVS-Matrix, Verzeichnis personenbezogener Daten, Prüfumfang, Betriebsprüfung                                              |
| `docs/firebase-agent-playbook.md`                 | Verbindlicher Firebase-Betriebs-, Sicherheits- und Übergabeleitfaden                                                                                  |
| `.github/workflows/ci.yml`                        | Read-only CI-Gates für Pull Requests und `main`                                                                                                       |
| `supabase/migrations/`                            | Unveränderte historische Quelle für Datenmodell/Seeds und möglichen Rollback                                                                          |

### Datenfluss und Sicherheitsgrenze

```text
Browser → Next.js Route/Server Component → Session + Profil/Rolle → Zod → Firebase Admin → Firestore
                                         ↘ SMTP / Anthropic (nur validierte, minimierte Daten)
```

Der Browser verwendet kein Firebase-Client-SDK für Daten. Private Beratungsmails liegen getrennt in
`clinicContacts`; öffentliche Clinic-Dokumente enthalten sie nicht. E-Mail-Adressen werden erst für
eine serverseitig validierte Empfehlungskarte geladen. Firestore und Storage lehnen Client-Schreib-
zugriffe ab; App Hosting schreibt mit der dedizierten, eingeschränkten Runtime-Identität
`law-clinic-runtime`. Die standardmäßige Build-Identität besitzt keine Rollen für Anwendungsdaten.

Firebase-Auth-Zustand liegt ausschließlich im begrenzten `HttpOnly`-Cookie `__session` (`Secure` in
Produktion, `SameSite=Lax`, fünf Tage). ID- und Refresh-Tokens werden nicht im Browser gespeichert.
Ein gültiges Cookie allein reicht nicht: `requireRole` lädt immer das aktuelle `profiles/{uid}`-
Dokument, sodass Löschung, Sperre oder Rollenänderung sofort wirken.

Alle Browser-Mutationen müssen zusätzlich vom exakten kanonischen Site-Origin stammen. Direkte
Requests vergleichen Origin, Request-URL und Host; hinter App Hosting darf nur der validierte
`NEXT_PUBLIC_SITE_URL`-Origin vom internen Cloud-Run-Host abweichen. HTML-Antworten erhalten eine
nonce-basierte CSP mit `script-src 'self'`; HSTS, Frame-/MIME-Schutz, Referrer- und
Permissions-Policy gelten auf allen Antworten. Clinic-Homepages akzeptieren nur `http:`/`https:`
und Branding-SVGs werden vor der Auslieferung als PNG neu codiert.

`proxy.ts` verwirft jeden eingehenden `X-Request-Id`-Wert, erzeugt an der vertrauenswürdigen Grenze
eine UUID, sendet sie in der Antwort zurück und reicht sie an strukturierte Child-Logger weiter.
Damit lässt sich ein fehlgeschlagener Request korrelieren, ohne Body, Token oder PII zu protokollieren.

### Authentifizierung und SMTP

Der Login erzeugt nie ein Konto. Auf ausdrücklichen Nutzerwunsch meldet das Formular eindeutig, wenn
keine zugelassene Firebase-Identität mit aktivem Profil existiert; das ist ein bewusst akzeptierter
Enumeration-Trade-off. Exakter Origin, Zod-Validierung und Per-IP-Limits bleiben aktiv, während
SMTP-/Infrastrukturfehler weiterhin keine Kontoinformation verraten. Der Server erzeugt einen
Firebase-E-Mail-Link, bindet ihn an einen gehashten, einmaligen Firestore-State und sendet die lokale
HTML-/Textvorlage über `SMTP_HOST`, `SMTP_PORT`, `SMTP_LOGIN_EMAIL` und `SMTP_PASSWORD`. Ein
Providerwechsel benötigt nur Konfiguration. `/auth/confirm` tauscht den Code serverseitig und setzt
das Session-Cookie. Neue E-Mail-Links tragen Code und State ausschließlich im URL-Fragment, das nie
an App Hosting gesendet wird; die Bestätigungsseite entfernt es sofort aus der Browserhistorie und
übergibt es validiert an `POST /api/auth/confirm`. Der Endpoint ist Same-Origin- und rate-limitiert,
und seine Antwort erlaubt nur feste lokale Ziele. Auf der Bestätigungsseite wird kein
Drittanbieter-Analytics initialisiert; optionale GA4-IDs werden vor Einbettung in das
nonce-autorisierte Skript streng validiert.

**Das SMTP-Ziel wird vor jeder Verbindung geprüft.** Admins konfigurieren den Host frei, also darf
der Server nicht auf beliebige Adressen verbinden: Alle A- und AAAA-Antworten werden unmittelbar vor
dem Verbindungsaufbau aufgelöst und abgelehnt, sobald _eine_ davon loopback, link-local, privat,
CGNAT oder anderweitig reserviert ist — auch in IPv4-gemappter IPv6-Form. IP-Literale als Host sind
nicht zulässig. Verbunden wird dann mit genau der geprüften Adresse, während der DNS-Name nur noch
zur Zertifikatsprüfung dient; damit kann der Name zwischen Prüfung und Verbindung nicht wechseln
(DNS-Rebinding). Port 465 nutzt implizites TLS, jeder andere Port erzwingt STARTTLS, und
`rejectUnauthorized` ist im Typ als `true` festgeschrieben. Ein abgelehntes Ziel meldet dem Admin
denselben allgemeinen Verbindungsfehler wie ein nicht erreichbarer Host, damit die Oberfläche kein
Netzwerk-Orakel wird.

Konten entstehen ausschließlich in geprüften Admin-/Signup-Workflows über das Admin SDK. Identity
Platform wird zusätzlich so konfiguriert, dass Endnutzer-Signup und -Löschung deaktiviert sind; die
deployed `beforeAccountCreated`-Funktion lehnt jede direkte Client-Erstellung ab. Admin-SDK-Importe
und -Einladungen umgehen den Blocker absichtlich.

Ein Admin-E-Mail-Wechsel verlangt eine höchstens fünf Minuten alte Authentifizierung, reserviert die
neue Adresse atomar und wird erst nach Firebase-Verifikation abgeschlossen. Firebase informiert die
alte Adresse über die Änderung. Danach wird die Sitzung gelöscht und eine neue Anmeldung verlangt.

Die SMTP-Zugangsdaten sind unter `/admin/smtp` administrierbar, ohne den Provider im Code zu kennen.
Host, Port, TLS-Modus, Login, Passwort/Key, Absenderadresse und Absendername bilden **eine**
vollständige Nutzlast, die als versionierte Secret-Manager-Version aktiviert wird. Jede Änderung
verlangt aktiven Admin, exakten Origin, eine höchstens fünf Minuten alte Anmeldung, Zod-Validierung,
ein Ratenlimit und einen `Idempotency-Key`; die vorgeschlagenen Werte werden zuerst serverseitig mit
erzwungenem TLS gegen den Server authentifiziert und erst danach aktiviert. Ein Mailversand findet
für diese Prüfung nicht statt. Die vorherige aktivierte Version bleibt als Rollback-Ziel erhalten und
kann im selben Bereich wieder aktiviert werden. Das Passwort verlässt den Server nie: der Browser
sieht ausschließlich „gesetzt“ oder „nicht gesetzt“, und das Auditereignis enthält nur Akteur-UID,
Zeit, Version und geänderte Feldnamen. Die Laufzeit liest die aktive Nutzlast kurz zwischengespeichert
pro warmer Instanz; solange keine Version aktiviert ist, gelten weiterhin die `SMTP_*`-Variablen der
Umgebung. Emulator- und E2E-Läufe greifen nie auf Secret Manager zu.

Ein eingereichter, noch nicht veröffentlichter Eintrag benachrichtigt genau einen Admin: den unter
`/admin/admins` gewählten Empfänger, der zugleich die Google-Cloud-Betriebsalarme erhält. Diese
Auswahl ist die einzige Adresse für Admin-Kommunikation. Die Mail geht einmal pro unveröffentlichtem
Zyklus heraus; die Marke wird in derselben Transaktion wie die Speicherung beansprucht, sodass
gleichzeitige Wiederholungen nicht doppelt senden, und beim Veröffentlichen wieder freigegeben —
ein zurückgezogener und überarbeiteter Eintrag meldet sich also erneut. Die Veröffentlichung selbst
benachrichtigt die Clinic an ihrer Beratungsadresse, und zwar nur bei der allerersten
Veröffentlichung. Beide Wege geben ihre Marke wieder frei, wenn kein Empfänger existiert oder der
Versand scheitert, damit ein späterer Schreibvorgang es erneut versucht. Protokolliert werden nur
Clinic-ID und Ergebnis, nie Name oder Adresse.

Die Anmelde-, Einladungs-, Adresswechsel- und Benachrichtigungsmails verwenden eine gemeinsame
gebrandete Vorlage, die
Wortmarke, Farben und Schrift aus den Branding-Einstellungen übernimmt und bei einem Branding-Ausfall
auf die Standardwerte zurückfällt. Sie bleibt tabellenbasiert und inline gestylt, lädt keine externen
Schriften, Bilder oder Skripte und liefert immer eine Textalternative. Code und State stehen weiterhin
ausschließlich im URL-Fragment.

### Firestore-Modell

| Dokument/Collection                                        | Inhalt                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `clinics/{id}` / `clinicContacts/{id}`                     | Öffentlicher Eintrag / private Beratungsmail                               |
| `clinics/{id}.submissionNotifiedAt` / `.publishNotifiedAt` | Transaktionale Marken der beiden Benachrichtigungen                        |
| `clinics/{id}.hiddenUntil` / `.hiddenReason`               | Selbstverwaltete Sichtbarkeit; `hiddenUntil` beendet eine befristete Pause |
| `profiles/{uid}`                                           | Rolle, Clinic-Zuordnung, Zugangsstatus und Aktivierung                     |
| `uniqueClinicNames`, `uniqueClinicOwners`, `emailOwners`   | Transaktionale Ersatz-Invarianten für SQL-Unique/FK                        |
| `settings/chat`                                            | Einzige Quelle für alle Live-Prompts, Regler und eingefrorenen Defaults    |
| `settings/operations`                                      | Ausgewählte Admin-UID für Betriebsalarme; keine E-Mail-Kopie               |
| `branding/current` + `branding/**` in Storage              | Theme und als PNG normalisiertes Logo                                      |
| `conversations`, `conversationTranscripts`, `retention`    | Statistik, höchstens 200 redigierte Verläufe und Cap-State                 |
| `clinicEvents`, `clinicMetrics`, `adminMetrics`            | PII-freie Events und günstige Monatsaggregate                              |
| `claimLimits`, `chatDailyQuotas`                           | Transaktionale Missbrauchs-/Tagesgrenzen mit TTL                           |
| `authEmailStates`, `pendingEmailOwners`                    | Kurzlebige Einmal-State- und E-Mail-Reservierungen                         |
| `idempotencyKeys`                                          | Kurzlebige Einmal-Marken für wiederholbare Admin-Schreibvorgänge, TTL      |
| `logs`                                                     | PII-freie Admin-Protokolle, sieben Tage TTL                                |
| `migrationRuns/{runId}`                                    | Nicht-PII Checkpoints, Counts und Checksummen                              |

Firestore ersetzt keine SQL-Constraints automatisch. Alle Namen, Eigentümer und E-Mail-Adressen
werden deshalb über Hash-/Reservation-Dokumente in Transaktionen vergeben. Ein Pending-Eintrag kann
nie veröffentlicht sein. Ein Clinic-Mitglied kann nur die Clinic-ID aus seinem frisch geladenen
Profil verwenden. Der letzte Admin und der handelnde Admin selbst können nicht entfernt werden.

### Chat, Privatsphäre und Kosten

- **Google Cloud Sensitive Data Protection ist der Redaktor** (`REDACTION_PROVIDER=dlp`). Der
  gesamte Transkript-Verlauf geht als _eine_ Table-Anfrage an `content:deidentify` in
  `europe-west4`, bevor Anthropic oder Firestore ihn sehen. Es gibt **keine lokale Ersatzstufe**:
  Schlägt DLP fehl, antwortet der Chat mit 503, statt einen ungeprüften Text weiterzureichen
  („fail closed"). Die Prüfung läuft **vor** dem Tageskontingent, damit ein DLP-Ausfall keine
  Nachricht der ratsuchenden Person verbraucht. `npm run dlp:check` verifiziert die Konfiguration.
- **Postleitzahl, Stadt und Region bleiben lesbar.** Der Finder vermittelt an eine Clinic in der
  Nähe, und das Modell kennt den Ort nur, weil die ratsuchende Person ihn geschrieben hat. Deshalb
  wird kein ortsbezogener Detektor angefordert (`LOCATION`, `LOCATION_COORDINATES`,
  `STREET_ADDRESS`, `GEOGRAPHIC_DATA`), eine Exclusion-Rule schützt die Regionsliste des Finders vor
  `PERSON_NAME`, und eine Nachbedingung verwirft eine Antwort, die eine Postleitzahl oder Region
  doch entfernt hat.
- **Bekannte Restrisiken der DLP-only-Entscheidung:** Für verschleierte E-Mail-Adressen
  („anna (at) beispiel (punkt) de"), Sozialversicherungsnummern, Aktenzeichen und deutsche
  Kfz-Kennzeichen gibt es keinen DLP-Detektor; diese Angaben erreichen das Modell unredigiert. Ein
  DLP-Ausfall ist ein Chat-Ausfall.
- Das Modell sieht nur validierte Directory-Daten ohne Beratungsmails und darf nur IDs empfehlen,
  die es im selben Gespräch aus der Suche erhielt.
- Der Stream ist NDJSON. Clients puffern Teilzeilen und ignorieren unbekannte Frames.
- `settings/chat` ist die einzige Quelle für Rolle, Ablauf, Grounding, Modell und Grenzwerte. Fehlt
  ein Pflichtwert, bleibt der Chat geschlossen; es gibt keinen Code-Fallback.
- Das `lcf_chat_quota`-Cookie enthält einen zufälligen Klarwert, Firestore nur dessen SHA-256-Hash.
  Eine Transaktion erlaubt zwei Gespräche pro Berliner Kalendertag und acht User-Turns je Gespräch.
- Kurzes IP-Burst-Limit bleibt pro Instanz; App Hosting/Proxy muss die echte Client-IP liefern.
- Monatsaggregate verhindern teure Vollscans. Nicht abgefragte große/TTL-Felder sind nicht indexiert.

### Kosten und Wirtschaftlichkeit

- Navigationslinks in Admin- und Mitgliederbereich laden **nicht** spekulativ vor. Ein Aufruf von
  `/admin` löste sonst sechs parallele RSC-Anfragen aus; bei `minInstances: 0` ist jede davon ein
  Kaltstart, drei Instanzen liefen gleichzeitig und der Cloud-Run-Instanzalarm schlug an.
- Das Dashboard zählt Clinics über Aggregationsabfragen statt über das Einlesen aller Dokumente:
  fünf Kennzahlen kosten drei Reads statt 118.
- Nur `warn` und `error` landen in Firestore; `info`/`debug` bleiben in Cloud Logging.
- Lesbare Transkripte laufen nach 90 Tagen ab, Statistiken nach zwölf Monaten.
- GA-Kennzahlen werden fünf Minuten pro warmer Instanz zwischengespeichert.

### Missbrauchsschutz

Die erste Nachricht eines Gesprächs muss eine Challenge lösen. Die Grenze ist provider-neutral:
Standard ist ein selbst gehosteter Proof-of-Work — keine dritte Partei, kein Cookie, kein
Einwilligungsbedarf und nichts bereitzustellen. Cloudflare Turnstile ist implementiert und wird über
`CHALLENGE_PROVIDER=turnstile` aktiv, sobald die Seite hinter Cloudflare steht; das Client-Widget
benötigt dann noch einen Site-Key. Nur der erste Zug wird geprüft, die Lösung ist an die `sessionId`
gebunden, und geprüft wird vor dem Verbrauch des Tageskontingents.

Firebase App Hosting liegt hinter dem Google Front End, das volumetrische L3/L4-Angriffe abfängt.
Eine L7-WAF, Bot-Filterung oder Ratenbegrenzung gibt es dort **nicht**, und App Hosting stellt Cloud
Armor nicht bereit. Der geplante Weg ist Cloudflare als Reverse Proxy vor App Hosting — nicht ein
Cloudflare Tunnel, der einen privaten Origin veröffentlicht. Vor der Umstellung muss
`TRUSTED_PROXY=cloudflare` gesetzt **und** der Origin auf Cloudflare-Bereiche beschränkt werden;
sonst ist `CF-Connecting-IP` fälschbar und jedes Per-IP-Limit wirkungslos.

### Hosting

Empfohlen ist Firebase App Hosting in `europe-west4` (Niederlande), mit Firestore Standard und
Storage in derselben Region. App Hosting hat derzeit keine deutsche Region. Diese EU-Kombination
vermeidet regionsübergreifende Latenz und Egress. `apphosting.yaml` startet mit `minInstances: 0`,
höchstens drei Instanzen, Concurrency 80 und 512 MiB, um Leerlaufkosten und Ausreißer zu begrenzen.
`firebase.json` erlaubt den lokalen App-Hosting-Quellrollout erst seit der SMTP-, IAM- und
Staging-Schutz vorbereitet und der alte Supabase-Quellschlüssel widerrufen wurde.

Der Zielzustand für Auslieferung ist die native Firebase-App-Hosting-Verknüpfung mit
`hackerFlo/Law-Clinic-Finder`, Repository-Wurzel `/`, Live-Branch `main` und automatischen Rollouts.
Sie benötigt keinen langlebigen Google-Schlüssel in GitHub. Ein read-only GitHub-Workflow prüft
TypeScript, Tests, Functions, Lint, Formatierung, Build und Produktionsabhängigkeiten. Gewöhnlicher
Arbeitsfluss: Feature-Branch → Pull Request → grüne CI → Merge nach `main` → automatischer
App-Hosting-Rollout. Functions, Regeln, IAM, Secrets, Backups und Auth-Konfiguration bleiben bewusst
explizite, zielgeprüfte Deployments.

Die regionale Developer-Connect-Verknüpfung ist eingerichtet und hat einen `main`-Commit korrekt
abgerufen und gebaut. GitHub Actions prüft dabei nur den Code; Firebase App Hosting übernimmt den
Deploy unabhängig über Developer Connect. Ein Build im Zustand READY genügt nicht: Erst ein
SUCCEEDED-Rollout mit passendem Commit und 100% Cloud-Run-Traffic gilt als ausgeliefert. Die exakten
Prüf-, Fehlerbehebungs- und Berechtigungsgrenzen stehen im
[`Firebase Agent Playbook`](docs/firebase-agent-playbook.md#automatic-app-hosting-delivery).

Der erste Staging-Rollout bleibt durch HTTP Basic geschützt. Der Schutz läuft vor allen Seiten und
API-Routen, gibt die Zugangsdaten nicht an die Anwendung weiter, verhindert Shared-Cache-Antworten
und benötigt keine Firestore-Lese- oder Schreibvorgänge. Lokal ist er standardmäßig aus. Vor der
öffentlichen Freigabe werden die drei `STAGING_ACCESS_*`-Variablen entfernt und die rechtlichen
Platzhalter ersetzt.

Ein Firebase-Hosting-Proxy vor Cloud Run in Frankfurt ist nicht der Standard, weil dynamische
Antworten dort nach 60 Sekunden enden können; der mehrstufige Streaming-Chat kann länger dauern.
Direktes Cloud Run in Frankfurt bleibt nur der dokumentierte Fallback, falls der App-Hosting-Adapter
mit Next.js 16 im Staging tatsächlich inkompatibel ist.

Betriebsalarme werden unter `/admin/admins` einer aktiven Admin-UID zugeordnet. Ohne Auswahl gilt
der einzige beziehungsweise am längsten bestehende aktive Admin. Firestore speichert nur die UID;
die aktuelle E-Mail kommt beim Synchronisieren aus Firebase Auth. Eine getrennte
Least-Privilege-Funktion mit `minInstances: 0` und `maxInstances: 1` aktualisiert ereignisgesteuert
einen verwalteten E-Mail-Kanal sowie eingebaute Cloud-Run-Alarme für 5xx und das Instanzlimit. Es
gibt weder Uptime-Polling noch eine eigene Log-Metrik.

## Conventions

- Next.js 16 Request-APIs sind asynchron (`await cookies()`, `await params`); `proxy.ts` ersetzt
  `middleware.ts`. Vor Framework-Änderungen die installierten Guides unter
  `node_modules/next/dist/docs/` lesen.
- Alle externen Inputs und Firestore-Dokumente werden mit Zod validiert. Fehler an Clients bleiben
  generisch; Serverlogs sind strukturiert und enthalten keine Tokens, Bodies, Nachrichten oder PII.
- Serverfunktionen erhalten kleine Repository-/Store-Ports. Firebase-Typen bleiben in
  `src/lib/firebase/`; UI und Domänenlogik kennen keine Cloud-Abfragesyntax. Datenbank-Client,
  `Timestamp`, `FieldPath` und `FieldValue` kommen einheitlich aus `firebase-admin/firestore`, damit
  der Produktions-Bundler keine inkompatiblen Firestore-Instanzen erzeugt.
- `@supabase/supabase-js` und der direkte `@google-cloud/firestore`-Client sind ausschließlich
  Entwicklungsabhängigkeiten für die ignorierten lokalen Kopier-/Importskripte. Ein Konfigurationstest
  verhindert ihre Aufnahme in `src/`, Produktionsabhängigkeiten oder das App-Hosting-Quellarchiv.
- `settings/chat` bleibt strikt DB-only. Admin-editierbare Prompt-Texte werden nie als Codekopie
  ergänzt; Änderungen/Defaults laufen über eine versionierte, idempotente Datenmigration.
- Clinic-Felder mit Mehrfachwerten bleiben `"; "`-getrennter Text und verwenden die gemeinsamen
  Vorschläge/Parser in `src/lib/clinics/options.ts`.
- Veröffentlichung setzt die Pflichtfelder aus `publish-requirements.ts` und
  `approvalStatus=approved` voraus. Auto-Veröffentlichung ist nur bei der ersten Aktivierung erlaubt.
- Gemeinsame UI-Elemente und Designtokens werden nicht kopiert, sondern über Komponentenvarianten
  und CSS-Custom-Properties erweitert.
- Öffentliche Inhalte haben neun Sprachen; `ar`/`fa` sind RTL. Portal, Login und Signup bleiben
  deutsch. Die bewusst deutschen Landing-Texte liegen einmalig in `deOnly`.
- `console.log`, Klartext-Secrets, Service-Account-Dateien und `.env`-Dateien gehören nicht in
  ausgelieferten Code oder Git.
- Wachsende Daten erhalten TTL: Auth-/Quota-State kurzlebig, Logs sieben Tage, Conversation/Event-
  Statistik etwa zwölf Monate; lesbare Transkripte nur 90 Tage und höchstens die neuesten 200.
  Nach Firestore werden ausschließlich `warn` und `error` geschrieben — Routinemeldungen bleiben in
  Cloud Logging, weil jede persistierte Zeile ein Dokument-Write kostet.
- Per-IP-Limits verwenden bei App Hosting die validierte, vorletzte Adresse der von Google
  ergänzten `X-Forwarded-For`-Kette; ein vom Client gesetzter Präfix wird nie vertraut.
- Tests liegen neben der Implementierung. Kritische Transaktionen benötigen Emulator-Integration;
  Regeln werden separat mit `npm run test:rules` geprüft.
- Vor Firebase-, Auth-, Daten-, Secret-, IAM- oder Hosting-Arbeit ist der vollständige
  [`Firebase Agent Playbook`](docs/firebase-agent-playbook.md) verbindlich. Er enthält feste Ziele,
  Freigabegrenzen, Deploy-Matrix, Rollback, Kosten- und Datenschutzregeln.

## Spec & Status

Zielprojekt: `law-clinic-finder`. Zielregion: `europe-west4`. Supabase ist derzeit nicht öffentlich
in Benutzung und bleibt als Quelle/Backup vollständig erhalten. Die Migration kopiert ausschließlich;
kein Transfer-Skript enthält eine Supabase-Delete-/Update-Operation.

GitHub-Meilenstein: `main` enthält die vollständige Firebase-Migration direkt und ohne Pull Request;
Commit `640036e` war die geprüfte Quelle des ersten anschließend ausgerollten Staging-Builds. Die
native regionale Verbindung zu `hackerFlo/Law-Clinic-Finder` ist vollständig und hat Commit
`cc4ef327bbf7d0741c3672d56562972624bb1b3f` korrekt als READY-Build 009 erstellt. Wegen des
Firebase-Console-Fehlers `getSourceCase` entstand dafür noch kein Rollout; 100% Traffic bleibt
bewusst auf dem verifizierten Rollout 008. Der Stand bleibt zugriffsgeschütztes Staging und ist
ausdrücklich noch keine öffentliche Veröffentlichung.

Aktueller Stand (2026-08-22): lokale App-Umstellung 100%, vollständige Migration bis zum
produktiven Cutover ungefähr 94%. Runtime-Pfade für Public Site, Chat, Clinic/Admin, Auth, Signup,
Branding, Logs, Quota und Metriken verwenden Firebase. `primary-eu`, Storage, Identity Platform mit
Blocking Function und App Hosting liegen in `europe-west4`; Client-Regeln, Least-Privilege-IAM,
API-Key-Einschränkung, regionale Secrets, Runtime-Limits, Abrechnungssicherung und tägliche
Sieben-Tage-Backups sind eingerichtet. Der Brevo-Sender ist für Staging verifiziert und DMARC ist
konfiguriert; die eigene DKIM-Domainauthentifizierung bleibt vor Produktion offen.

Die freigegebene Kopie `copy-20260822-staging`, ihre abschließende Reconciliation und eine neue
unabhängige Prüfung stimmen über 169 vorbereitete Dokumente, die reale Auth-Identität, den
Branding-Datensatz und alle sechs Checksummen mit der Quelle überein. Die Quelle enthält kein eigenes
Logo-Objekt. Direkte Semantikprüfungen bestätigen 59 Clinics, davon 47 veröffentlicht, sowie
gültige Identity-, Clinic-, Reservation-, Settings-, Branding- und Checkpoint-Referenzen. Supabase
wurde ausschließlich gelesen und bleibt vollständig erhalten; nur die zwei reservierten
`@example.com`-Entwicklungsidentitäten wurden im Firebase-Ziel ausgelassen.

Rollout `web-build-2026-08-22-008` aus Commit `640036e` läuft zu 100% hinter dem
Secret-Manager-gestützten Staging-Schutz unter `law-clinic-runtime`. Der erneute Smoke-Test erhielt
401, `no-store`, den Basic-Challenge und die erwarteten HTTPS-Sicherheitsheader; die vom CLI erneut
angelegte breite Build-Rolle wurde anschließend entfernt und es gab keine Error-Level-Logs der
neuen Revision. Ein frischer, gehärteter Fragment-plus-POST-Magic-Link wurde auf dem vorherigen
funktionsgleichen Rollout durch den Nutzer bis `/admin` bestätigt und durch PII-freie, query-lose
Cloud-Logs unabhängig belegt. Der Login zeigt den ausdrücklich gewünschten Fehler für nicht
registrierte Adressen. Unter `/admin/admins` kann ein aktiver Admin als Empfänger der
Google-Cloud-Betriebsalarme gewählt werden; Standard ist der einzige beziehungsweise älteste aktive
Admin. Der ereignisgesteuerte Sync hat einen aktivierten E-Mail-Kanal und eingebaute Cloud-Run-Alarme
für 5xx und das Instanzlimit angelegt. Neun Playwright-E2E-Journeys laufen ausschließlich gegen
Auth-/Firestore-/Storage-Emulatoren. Live-Staging-Prüfungen belegen zusätzlich strikte Browserregeln,
echte Brevo-Anmeldung, inkrementelles NDJSON-Streaming und die verzögerte `after()`-Persistenz; die
dabei exakt erzeugten Testdatensätze wurden anschließend entfernt.

Der freigegebene Restore von `restore-drill-20260822` bewies Wiederherstellung und Isolation; nur die
temporäre Datenbank wurde anschließend gelöscht, `primary-eu` blieb löschgeschützt und das Backup
READY. Da der verwendete Snapshot vom 21. August vor der Datenkopie liegt, enthielt er erwartungsgemäß
keine App-Collections. Eine Inhaltsprüfung mit dem ersten READY-Backup nach der Kopie bleibt offen.
Der Betreiber hat noch keine öffentliche Domain, kein endgültiges Impressum/keine endgültige
Datenschutzerklärung und noch keine vollständige Brevo-Domainauthentifizierung. Diese Punkte bleiben
bewusst als Go-live-Erinnerungen offen. Ebenfalls offen bleibt ein Inhalts-Restore aus dem ersten
READY-Backup nach der finalen Kopie; das Erstellen und anschließende Löschen einer neuen temporären
Datenbank benötigt weiterhin eine genaue Freigabe. Danach folgen Domain-/Link-Konfiguration,
öffentlicher Trafficwechsel und Beobachtung. Die gewünschte Auth-Mail-Gestaltung und
SMTP-Administration bleiben Phase 10.

Der verschlankte Arbeitsplan enthält ausschließlich noch offene Arbeit und die Resume-Reihenfolge:
[`docs/firebase-migration-plan.md`](docs/firebase-migration-plan.md). Abgeschlossene
Migrationshistorie bleibt in Git und `CHANGELOG.md`; laufende Firebase-Konventionen stehen im
[`Firebase Agent Playbook`](docs/firebase-agent-playbook.md).

Der Sicherheits- und Datenschutz-Härtungslauf gegen ASVS 5.0 L2 und AISVS 1.0 L2 ist abgeschlossen.
Bericht, Matrix, Verzeichnis der personenbezogenen Daten, Prüfumfang samt bestätigter Fehlalarme und
die nur lesenden Betriebsprüfungen stehen in
[`docs/audits/security-hardening-2026-08-22/`](docs/audits/security-hardening-2026-08-22/INDEX.md).

**Vor dem Livegang zwingend:** `apphosting.yaml` setzt `REDACTION_PROVIDER=dlp`, und die
De-Identifikation schließt fehlschlagend. Wird ausgerollt, bevor die Sensitive-Data-Protection-API
aktiviert und `law-clinic-runtime` die Rolle `roles/dlp.user` erteilt ist, antwortet der Chat
dauerhaft mit 503. `npm run dlp:check` prüft genau die Anfrage, die die Laufzeit schickt.

### Sichere Datenkopie

Die Quelle wird direkt und seitenweise gelesen; es entsteht kein PII-Export im Repo. Das Tool
validiert jede Zeile, normalisiert das Logo zu PNG, erhält Auth-UIDs, baut Reservations/Metriken neu
und setzt keine Supabase-Schreiboperation ab.

```bash
# 1. Standard: nur lesen, validieren, zählen und Checksummen ausgeben
npm run migrate:firebase -- --source-ref <SUPABASE_PROJECT_REF> --run-id copy-YYYYMMDD

# 2. Erst nach geprüftem Dry-Run und vorbereiteten Firebase-Ressourcen schreiben
npm run migrate:firebase -- --source-ref <SUPABASE_PROJECT_REF> --run-id copy-YYYYMMDD \
  --apply --confirm-target law-clinic-finder

# 3. Ziel danach erneut read-only verifizieren
npm run migrate:firebase:verify -- --source-ref <SUPABASE_PROJECT_REF> --run-id copy-YYYYMMDD

# 4. Nur bei Drift erwarteter Quellpfade: denselben geprüften Run gezielt abgleichen
npm run migrate:firebase -- --source-ref <SUPABASE_PROJECT_REF> --run-id copy-YYYYMMDD \
  --apply --reconcile --confirm-target law-clinic-finder
```

Beim ersten Apply verweigert das Tool ein nicht leeres Firebase-Daten-/Auth-Ziel ohne passenden
`migrationRuns/{runId}`-Checkpoint. Wiederholungen mit demselben Run sind idempotent und überspringen
nur Phasen mit identischer Anzahl und Checksumme. Bestehende Firebase- oder Supabase-Daten werden nie
automatisch gelöscht. Supabase-Sessions sind nicht übertragbar; nach Cutover ist ein neuer Magic Link
erforderlich. `--reconcile` verlangt einen bereits passenden Run, prüft dessen Checkpoints erneut und
überschreibt ausschließlich die exakten erwarteten Quelldokumentpfade; zusätzliche Firebase-
Runtime-Dokumente werden weder verändert noch gelöscht. Danach immer erneut mit `verify` prüfen.

### Cloud-Schritte vor Staging

- [x] Blaze aktivieren; App-Hosting- und Firestore-API sind freigeschaltet.
- [x] Leere Fehlanlage nach Freigabe löschen; `primary-eu` geschützt in `europe-west4` anlegen.
- [x] Identity Platform, Web-App, Storage und App-Hosting-Backend `web` in `europe-west4` anlegen.
- [x] Authorized Domains, Signup-/Löschsperre und `beforeAccountCreated` konfigurieren/deployen.
- [x] Rules, Indizes/TTL, Least-Privilege-IAM, API-Key-Einschränkung und tägliche Backups setzen.
- [x] Site-URL, Firebase-Auth-Key und Anthropic-Key regional in Secret Manager setzen.
- [x] SMTP-Secrets mit Zugriff nur über die dedizierte Runtime-Identität einrichten.
- [x] Live SMTP-Secret-Referenzen und Brevo-Authentifizierung über TLS auf Port 587 ohne Mailversand
      verifizieren; die gespeicherten Zugangsdaten werden akzeptiert.
- [x] Brevo-Sender für Testversand verifizieren und Abrechnungssicherung konfigurieren.
- [ ] Eigene Brevo-DKIM-Domainauthentifizierung vor Produktion abschließen.
- [ ] Das versionierte Secret `smtpSettings` in `europe-west4` anlegen, der Runtime-Identität
      ausschließlich `secretmanager.versions.access` und `secretmanager.versions.add` **auf genau
      dieses Secret** gewähren und eine Firestore-TTL auf `idempotencyKeys.expiresAt` setzen. Bis
      dahin bleibt `/admin/smtp` bewusst schreibgeschützt und der Versand nutzt die `SMTP_*`-Variablen
      der Umgebung.
- [x] Admin-Auswahl sowie günstige Cloud-Run-5xx-/Instanzlimit-Betriebsalarme einrichten.
- [x] Das starke `stagingAccessPassword`-Secret erstellen und dem Backend gewähren.
- [x] Den App-Hosting-Backend erstmals aus lokalem Quellstand hinter dem Zugriffsschutz ausrollen
      und die automatisch wiederhergestellte breite Build-Rolle erneut entfernen.
- [x] Erste freigegebene Datenkopie mit exakten Checksummen, Auth-Identität und Branding-Datensatz
      ausführen und unabhängig verifizieren; Supabase bleibt unverändert.
- [x] Geschützte Staging-Seite mit den privaten Vorschau-Zugangsdaten im Browser öffnen.
- [x] Reale Magic-Link-Zustellung über Brevo und Weiterleitung in den Admin-Bereich auf dem
      vorherigen und gehärteten Fragment-plus-POST-Rollout live nachweisen.
- [x] Restore-Mechanik in der freigegebenen getrennten Testdatenbank prüfen und nur diese löschen.
- [ ] Inhaltlichen Restore mit einem READY-Backup nach der Staging-Kopie prüfen.
- [x] Streaming/Auth/SMTP/Rollen und Accessibility im geschützten Staging prüfen.

Die ausdrücklich freigegebene erste Datenkopie und ihre unabhängige Verifikation sind abgeschlossen;
Backend `web` bleibt zugriffsgeschützt. Der öffentliche Trafficwechsel, weitere Datenbanklöschungen
und eine spätere Supabase-Deaktivierung benötigen weiterhin die im Plan festgelegten Eingaben,
Prüfungen beziehungsweise ausdrücklichen Freigaben.

Der zuvor auf die Zeit nach dem Cutover verschobene Admin-Bereich für provider-neutrale
SMTP-Konfiguration und die visuelle Überarbeitung aller Auth-Mails sind implementiert und getestet.
Passwörter/Keys liegen ausschließlich versioniert in Secret Manager und sind im Browser nur als
„gesetzt“ sichtbar. Die Funktion bleibt bis zur Cloud-Bereitstellung des Secrets bewusst
schreibgeschützt; sie zählt weiterhin nicht zum Migrationsfortschritt und ändert den Staging-Status
nicht.

Der gewünschte kanonische Firebase-Leitfaden für zukünftige Agenten ist jetzt unter
[`docs/firebase-agent-playbook.md`](docs/firebase-agent-playbook.md) vorhanden und aus der
Architekturkarte verlinkt.

## Versionierung

Das Projekt folgt Semantic Versioning und Keep a Changelog. Aktuelle Version:
`0.1.0-alpha.1`. Änderungen stehen in [`CHANGELOG.md`](CHANGELOG.md).
