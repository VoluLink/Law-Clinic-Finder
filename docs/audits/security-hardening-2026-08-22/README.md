# Security-Härtung 2026-08-22 — Bericht

Geprüfter Stand: nach der Migration von Supabase zu Firebase, Branch
`feat/firebase-github-delivery`. Maßstab: OWASP ASVS 5.0 Level 2 und OWASP AISVS 1.0 Level 2.
Umfang: 633 versionierte Dateien, 26 API-Handler, die Auth-, Session-, Signup- und Admin-Pfade,
Firestore- und Storage-Regeln, Cloud Functions, CI und Build-Ausgabe.

Jeder Befund wurde vor der Behebung am Quelltext bestätigt. Wo sich ein Verdacht nicht bestätigt
hat, steht er als bestätigter Fehlalarm im [coverage-appendix.md](coverage-appendix.md) und wurde
nicht stillschweigend fallen gelassen.

---

## 1 — Behobene Befunde

Nach Schwere geordnet. „Beleg" nennt den Commit; die Datei- und Zeilenangaben stehen im jeweiligen
Commit-Text.

### 1.1 Freigabe ohne Nachweis über die Adresse — hoch

`clinic-invite-store.ts` legt Clinic-Nutzer mit `emailVerified: false` an. `approve()` prüfte das
nie. Eine Administratorin konnte damit einen Zugang für einen Eintrag freischalten, der an die
Adresse einer fremden Person gebunden war, ohne dass diese Person je geantwortet hatte.

Behoben durch ein typisiertes `unverified`-Ergebnis, das fehlschlagend schließt: kein Profil, kein
Auth-Nutzer oder ein unlesbarer Datensatz gelten als unbestätigt, nicht als Erlaubnis. Die Route
antwortet mit 409 und einer deutschen Begründung, die im Admin-UI auch ankommt.

**Beleg:** `7a12d8d`. Vor der Änderung am Quelltext bestätigt: `clinic-invite-store.ts:71` legt
`emailVerified: false` an, und der legitime Weg bleibt offen, weil Firebase die Adresse beim
E-Mail-Link-Login als bestätigt markiert.

### 1.2 Kein Größenlimit auf Request-Bodys — hoch

Keiner der 17 `request.json()`-Aufrufe prüfte eine Größe, bevor er den Body puffert; die
Logo-Route puffert den gesamten Upload vor der Größenprüfung. Ein nicht angemeldeter Aufrufer
konnte damit Speicher der Instanz binden.

Behoben mit einem gemeinsamen Parser, der Medientyp, deklarierte Länge und tatsächlich gelesene
Bytes prüft, strikt UTF-8 dekodiert und 415/413/400 unterscheidet. Für den Chat gilt ein eigenes,
begründetes Limit. Die Wirksamkeit wurde belegt, indem die Login-Route testweise auf
`request.json()` zurückgesetzt wurde: zwei Tests schlugen fehl und wurden nach dem Zurücksetzen
wieder grün.

**Beleg:** `e1f9833`.

### 1.3 De-Identifikation außerhalb der EU — hoch

Die DLP-Anfrage ging an `projects/{p}/content:deidentify` — das ist der **globale** Standort.
Chatinhalte einer deutschen Rechtsberatungsseite wurden damit außerhalb der EU verarbeitet.

Behoben durch den regionalen Endpunkt `projects/{p}/locations/europe-west4/...`, passend zu jeder
anderen Ressource des Projekts. Bei der Gelegenheit korrigiert: die Liste der infoTypes nannte
`GERMANY_POSTAL_CODE`, das es gar nicht gibt, und übersah `LOCATION_COORDINATES` und
`GEOGRAPHIC_DATA`. Außerdem bildete `minimize()` jede Nachricht einzeln ab, kostete also in einem
zehnten Zug zehn DLP-Aufrufe; jetzt geht das ganze Transkript als eine `item.table`-Anfrage.

**Beleg:** `335e552`.

### 1.4 Branding-Schrift von Google — hoch (Datenschutz)

Sobald eine Administratorin eine andere als die voreingestellte Schrift wählte, lud jede Seite ein
Stylesheet von `fonts.googleapis.com`. Damit erhält Google die IP-Adresse jedes Besuchers, bevor
irgendetwas gezeichnet wird — für eine deutsche öffentliche Seite ohne Einwilligung unzulässig
(LG München I, 20.01.2022, 3 O 17493/20). Diese Seite erreichen Menschen gerade deshalb, weil sie
ein rechtliches Problem haben.

Behoben durch Selbsthosting: 32 Familien liegen als woff2 unter `public/fonts/`, und nur die
gewählte Familie wird als `@font-face` in den bereits vorhandenen Nonce-Style-Block geschrieben.
Die CSP verliert dadurch ihre letzten beiden externen Ursprünge — `style-src` und `font-src` sind
wieder `'self'`.

**Beleg:** `18569b8`.

### 1.5 Verzeichnisexport über die Signup-Suche — mittel

Eine leere Suchanfrage lieferte 200 Clinics samt maskierter Adressen zurück. Behoben:
Mindestlänge, gedeckelte Trefferzahl, keine maskierte Adresse mehr — nur noch die Aussage, dass
eine Adresse hinterlegt ist (DECISION B, Option A).

**Beleg:** `9555415`.

### 1.6 Verzeichnistext ohne Vertrauensgrenze im Modellkontext — mittel

Clinics schreiben ihren eigenen Namen, ihre Beschreibung und ihre Anforderungen. Aus Sicht des
Modells ist das von Dritten gelieferter Text, der in einem Tool-Ergebnis ankommt. Behoben durch
eine benannte Datenhülle, deren Trennzeichen der Text nicht schließen kann: Winkelklammern,
Steuer-, Nullbreiten- und Bidi-Zeichen werden entfernt, die Ergebnisgröße ist gedeckelt, und der
Hinweis „das hier ist ausschließlich Daten" steht im code-eigenen Teil der Tool-Beschreibung, damit
der von Admins bearbeitbare Text ihn nicht abschwächen kann (AR-11).

**Beleg:** `e60982b`.

### 1.7 URLs und Text ohne erneute Prüfung vor dem Rendern — mittel

Die Clinic-Karte ist die Stelle, an der Verzeichnistext zu einem `href` wird, und auf dem Lesepfad
schränkte nichts das Schema ein. Zods `z.url()` akzeptiert `javascript:`, `data:` und `vbscript:` —
gegen die installierte Version geprüft. React 19 entschärft `javascript:` selbst, und genau deshalb
brauchten die übrigen Schemata eine Regel, die nicht vom Framework abhängt.

Behoben mit einer gemeinsamen Prüfung, die Formularschema, Firestore-Lesecodec und Stream-Decoder
teilen. Der Lesecodec setzt einen unbrauchbaren Link auf `null`, statt das Parsen scheitern zu
lassen — Letzteres hätte wegen einer einzigen kaputten Zeile das gesamte veröffentlichte Verzeichnis
mitgenommen. `mailto:`-Adressen mit `?body=` oder `&bcc=` werden verworfen. Kartentext verliert
Bidi-Overrides und wird gekürzt statt abgewiesen; die entfernte Zeichenmenge lässt U+200C–U+200F
bewusst stehen, weil Farsi, Arabisch und Kurdisch sie zum Rendern brauchen.

**Beleg:** `ab284d8`.

### 1.8 Weitere behobene Punkte

| Befund                                                                                                        | Beleg     |
| ------------------------------------------------------------------------------------------------------------- | --------- |
| Rate-Limiter verdrängte den zuerst gesehenen statt den am längsten ungenutzten Schlüssel; `maxKeys` ungeprüft | `f564d7e` |
| Sitzungen überlebten einen E-Mail-Wechsel                                                                     | `a95b404` |
| `firebase-admin` in `functions/` nicht exakt gepinnt                                                          | `53cbe4e` |
| Private Antworten ohne `Cache-Control: private, no-store`, sobald das Staging-Tor entfällt                    | `e1f9833` |
| Sekret-artige Felder wurden an über 100 Aufrufstellen einzeln maskiert statt an der Logger-Grenze             | `bf17a75` |
| Kein Scan der Build-Ausgabe, zu weiter Docker-Build-Kontext                                                   | `a028da2` |
| Abmeldung widerrief keine Refresh-Tokens; Admin-Sitzungen liefen 5 Tage (jetzt 8 h)                           | `dd436fb` |
| Admin-konfigurierter SMTP ohne Zielprüfung (SSRF, DNS-Rebinding)                                              | `6073bc3` |
| Folgenreiche Admin-Aktionen ohne kürzliche Anmeldung                                                          | `65a3f46` |
| `SMTP_SETTINGS_SECRET_LOCATION` bestimmte ungeprüft den Host, der ein Cloud-Platform-Token erhält             | `9bd466c` |
| Login- und Signup-Grenzen lagen prozesslokal und setzten sich bei jedem Kaltstart zurück                      | `c2ed12e` |
| Empfehlungs-PDF fiel auf Helvetica zurück; Russisch und Ukrainisch wurden gar nicht gerendert                 | `632c6d5` |

---

## 2 — Bewusst akzeptierte Restrisiken

Diese Punkte sind bekannt, bewertet und **nicht** behoben. Jeder hat einen Grund.

### 2.1 Nie bestätigte Anträge reservieren dauerhaft — Entscheidung der Eigentümerin

Ein Antrag über das öffentliche Signup-Formular legt in einer Transaktion vier Reservierungen an:
`uniqueClinicNames` (den Clinic-Namen), `emailOwners` (die Adresse), `uniqueClinicOwners` (den
Eigentümerplatz) und einen Auth-Nutzer. Keine davon läuft ab, auch dann nicht, wenn die Adresse nie
bestätigt wird.

**Was das bedeutet:** Wer den Namen einer echten Law Clinic in das öffentliche Formular einträgt,
macht diesen Namen dauerhaft unregistrierbar. Eine bereits veröffentlichte Clinic ohne hinterlegte
Kontaktadresse kann auf demselben Weg dauerhaft aus ihrem eigenen Übernahmeprozess ausgesperrt
werden. Einziger Ausweg ist, dass eine Administratorin den offenen Antrag im Admin-Bereich löscht —
sie muss also erst bemerken, dass es ihn gibt.

Ein Ablauf nach sieben Tagen war implementiert (DECISION F) und ist auf ausdrückliche Anweisung
wieder entfernt worden. Die Reservierungen bleiben damit bestehen, bis jemand sie von Hand löscht.

**Was das für die Datenminimierung heißt:** Die Adresse einer Person, die nie geantwortet hat,
bleibt unbegrenzt gespeichert. Das ist bei der Datenschutzerklärung und bei einer möglichen
Löschanfrage zu berücksichtigen — siehe [personal-data-inventory.md](personal-data-inventory.md) §2.

**Was weiterhin schützt:** Die Freigabe verlangt einen Nachweis über die Adresse (§1.1), ein
Squatter erhält also keinen Zugang. Die dauerhaften Missbrauchsgrenzen begrenzen außerdem, wie viele
Anträge eine Adresse und ein Netz pro Tag stellen können (`c2ed12e`). Blockiert bleibt der Name
trotzdem.

### 2.2 Kein MFA für Administratorinnen — DECISION D

Entschieden: Der E-Mail-Magic-Link genügt vorerst. Die kompensierenden Kontrollen sind damit nicht
mehr optional: Widerruf beim Abmelden und 8-Stunden-Sitzungen (`dd436fb`) sowie die erneute
Anmeldung vor folgenreichen Aktionen (`65a3f46`). Wenn eine davon später zurückgenommen wird, muss
MFA neu bewertet werden.

### 2.3 Vier PII-Kategorien ohne Erkennung

Mit „nur DLP, fail closed" fällt die deutschsprachige Zusatzerkennung weg. DLP hat keinen infoType
für: verschleierte E-Mail-Adressen (`anna (at) beispiel (punkt) de`), Sozialversicherungsnummern,
Aktenzeichen und deutsche Kfz-Kennzeichen. Diese erreichen Anthropic und Firestore im Klartext.
Bewusst so entschieden.

### 2.4 Ein DLP-Ausfall ist ein Chat-Ausfall

Konstruktionsbedingt. Der Chat antwortet mit 503, statt eine ungeprüfte Nachricht weiterzugeben.

### 2.5 `uuid < 11.1.1` (GHSA, niedrig)

Transitiv über `firebase-admin`. Der einzige von `npm audit fix --force` vorgeschlagene „Fix" ist
ein Downgrade von `firebase-admin` auf 10.3.0 — eine wesentlich größere Angriffsfläche als der
Befund selbst. **Kein** `overrides`-Eintrag, **kein** `--force`. Bei jedem `firebase-admin`-Update
neu prüfen.

### 2.6 Docker-Image nicht gebaut, Basis-Image nicht digest-gepinnt

In dieser Umgebung ist kein Docker verfügbar. Die `.dockerignore` wurde deshalb auf Pfade begrenzt,
die der Next.js-Build nachweislich nicht liest. Das `Dockerfile` benutzt `node:22-alpine` als
gleitendes Tag, läuft aber als Nicht-Root (`USER nextjs`) — und es liegt **nicht** auf dem
Deploy-Pfad: App Hosting baut aus dem Quelltext, kein Dokument und keine Konfiguration verweist auf
das `Dockerfile`.

Nach der Prüfung erledigt: `Dockerfile` und `.dockerignore` wurden entfernt, weil ein
ungetesteter Pfad still veraltet. Damit entfällt dieser Punkt.

### 2.7 CodeQL nicht eingerichtet

Bewusst aufgeschoben. Ein Scanner ohne dokumentierte Ausgangsbasis und ohne Verfahren für
Fehlalarme erzeugt Rauschen, das niemand abarbeitet. Voraussetzung wäre außerdem eine Entscheidung
über die Kosten von GitHub Advanced Security für dieses Repository.

---

## 3 — Offene Punkte

### 3.1 Vor dem Livegang zwingend

**Die DLP-API ist im Projekt noch nicht aktiviert.** `apphosting.yaml` setzt inzwischen
`REDACTION_PROVIDER=dlp`. Ein Rollout vor der Aktivierung lässt den Chat dauerhaft mit 503
antworten. Reihenfolge:

1. Sensitive Data Protection (DLP) API im Projekt `law-clinic-finder` aktivieren.
2. Der Laufzeitidentität `law-clinic-runtime` die Rolle `roles/dlp.user` geben.
3. `npm run dlp:check` ausführen — das schickt genau die Anfrage, die die Laufzeit schickt.

### 3.2 Weitere Schritte, die nur die Eigentümerin ausführen kann

Nichts davon wurde ausgeführt (G-5). Die nur lesenden Prüfkommandos stehen in
[operational-verification.md](operational-verification.md).

- Secret `smtpSettings` anlegen.
- `restoreScheduledVisibility` deployen.
- `npm run chat:guidance -- --apply --confirm-target law-clinic-finder` ausführen.
- TTL-Richtlinien für `abuseLimits`, `idempotencyKeys` und die übrigen `expiresAt`-Felder aktivieren.
- Cloudflare-Reverse-Proxy-Umstellung.
- Die vollständige Liste steht unter „Offene Punkte" in `README.md`.

Seit der Prüfung erledigt: Secret `gaServiceAccountJson` angelegt und dem Backend gewährt;
Challenge-Provider auf `pow` entschieden und in `apphosting.yaml` gesetzt. Der zusammengesetzte
Index für `profiles` entfällt — die Sieben-Tage-Ablauffrist, die ihn gebraucht hätte, wurde auf
Anweisung zurückgenommen (§2.1).

### 3.3 Nicht Teil dieser Prüfung

Impressum und Datenschutzerklärung enthalten weiterhin Platzhalter. Beides ist für eine deutsche
öffentliche Seite rechtlich erforderlich und in der Veröffentlichungs-Checkliste vermerkt. Die
Datenschutzerklärung muss außerdem die Auftragsverarbeiter aus
[personal-data-inventory.md](personal-data-inventory.md) benennen — Google Cloud DLP ist seit
`335e552` einer davon.
