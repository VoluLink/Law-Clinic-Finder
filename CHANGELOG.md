# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Firebase-Migration (in Arbeit)

- Diese Unreleased-Fassung ist der erste GitHub-Projektstand mit der Firebase-Migration. Sie bleibt
  als zugriffsgeschütztes Staging markiert; Domain, Rechtstexte, Brevo-DKIM und öffentlicher Cutover
  sind bewusst noch offen.
- Jede Antwort erhält an der vertrauenswürdigen Proxy-Grenze eine neue UUID als Request-ID; ein
  fremder Eingabewert wird verworfen. Route Handler reichen die ID an strukturierte Child-Logger
  weiter, ohne Request-Bodies, Tokens oder PII zu protokollieren.
- Neun Playwright-E2E-Journeys laufen ausschließlich gegen lokale Auth-/Firestore-/Storage-
  Emulatoren und prüfen Public Site, neun Sprachen/RTL, Analytics-Consent, unbekannte Konten,
  Admin-/Clinic-Rollen, Cross-Role-Denial und Accessibility. Geschütztes Staging belegt zusätzlich
  echtes NDJSON-Streaming und Next.js-`after()`-Persistenz.
- Das Kopierwerkzeug besitzt einen ausdrücklichen, getesteten `--apply --reconcile`-Modus für einen
  bereits passenden Migration-Run. Er prüft Checkpoints erneut und schreibt nur erwartete
  Quelldokumentpfade; zusätzliche Firebase-Runtime-Dokumente und Supabase bleiben unverändert.
- Die Anwendung verwendet serverseitig Firebase Authentication, Cloud Firestore und Cloud Storage
  statt Supabase. Passwortlose Firebase-Links werden über den provider-neutralen SMTP-Adapter
  versendet; Brevo bleibt die aktuelle Konfiguration.
- Unter `/admin/admins` wählt ein Admin den aktiven Admin für Google-Cloud-Betriebsalarme. Ohne
  Auswahl gilt der einzige beziehungsweise älteste aktive Admin; Firestore speichert nur dessen UID
  und der ereignisgesteuerte Least-Privilege-Sync löst die aktuelle Adresse aus Firebase Auth auf.
  Die Schreibtransaktion prüft Rolle und Aktivstatus erneut, um parallele Sperrungen abzufangen.
- Eingebaute Cloud-Run-Metriken überwachen 5xx und das konfigurierte Instanzlimit. Der Sync arbeitet
  mit null Mindest- und einer Höchstinstanz, ohne Uptime-Polling oder eigene Log-Metrik.
- Der ausdrücklich freigegebene Restore-Drill stellte das letzte READY-Backup isoliert nach
  `restore-drill-20260822` wieder her und löschte anschließend nur diese temporäre Datenbank. Der
  Snapshot lag vor der Datenkopie und war deshalb inhaltlich leer; ein Post-Copy-Inhaltsdrill bleibt
  offen. `primary-eu` und Supabase blieben unverändert geschützt.
- Das Login meldet auf ausdrücklichen Nutzerwunsch eindeutig, wenn keine zugelassene Identität mit
  aktivem Profil existiert. Same-Origin-Prüfung, Zod-Validierung und Rate Limits bleiben aktiv;
  SMTP-/Infrastrukturfehler bleiben generisch.
- Einmal-Code und State stehen in neuen Auth-Mails nur noch im URL-Fragment und gelangen deshalb
  nicht in App-Hosting-/Cloud-Run-Request-Logs. Die Bestätigungsseite entfernt das Fragment aus der
  Browserhistorie und sendet es validiert an einen Same-Origin- und rate-limitierten POST-Endpoint.
- Die Auth-Bestätigungsseite initialisiert keinerlei Drittanbieter-Analytics, solange der Browser das
  kurzlebige URL-Fragment verarbeitet. GA4-Mess-IDs werden außerdem streng validiert, bevor sie in
  das nonce-autorisierte Initialisierungsskript gelangen.
- Identity Platform wird durch eine immer ablehnende `beforeCreate`-Blocking-Function gegen direkte,
  unautorisierte Kontoerstellung abgesichert. Sessions liegen nur im begrenzten HttpOnly-Cookie;
  geschützte Operationen prüfen zusätzlich das aktuelle Firestore-Profil.
- Firestore- und Storage-Regeln schließen Browserzugriffe standardmäßig. Private Clinic-Kontakte,
  Auth-State und Transkripte bleiben server-only; Branding-Logos werden vor Storage als PNG neu
  codiert.
- Authentifizierte Schreibzugriffe verlangen zusätzlich einen exakten Same-Origin-Nachweis. Eine
  nonce-basierte Content Security Policy und weitere HTTP-Sicherheitsheader schützen die Next.js-
  Seiten; Clinic- und Import-URLs sind auf HTTP(S) und die Supabase-Quelle auf den exakten HTTPS-
  Projekt-Origin begrenzt.
- Ein dry-run-first Kopierwerkzeug liest Supabase ausschließlich seitenweise, validiert alle Daten,
  erhält Auth-UIDs, baut Reservations/Metriken neu und schreibt nur nach exakter Projektbestätigung.
  Checkpoints und Checksummen machen Apply/Verify wiederholbar; Supabase bleibt unverändert.
- Die zwei reservierten Entwicklungsidentitäten `admin@example.com` und
  `startright@example.com` samt Zugriffsprofilen werden nicht in Firebase übernommen. Die
  entsprechenden Supabase-Zeilen bleiben gemäß der Copy-only-Vorgabe unverändert erhalten.
- Der echte Supabase-Source-Dry-Run berücksichtigt beim Legacy-`claim_requests`-Schema `sent_at`
  statt eines nicht vorhandenen `created_at` und validiert die Quelle erfolgreich, ohne zu schreiben.
- Firestore-Emulatortests belegen die Transaktionsgrenzen bei gleichzeitigen Magic-Link-
  Bestätigungen, Claim-Versuchen und Registrierungen mit demselben Clinic-Namen.
- Firebase App Hosting, Firestore und Storage sind für `europe-west4` (Niederlande) geplant, da App
  Hosting keine deutsche Region anbietet. Instanzlimits und Write-time-Aggregate begrenzen Kosten.
- Nach ausdrücklicher Freigabe wurde die unbeabsichtigt in `nam5` angelegte, leere Standarddatenbank
  gelöscht. Die benannte, löschgeschützte Firestore-Datenbank `primary-eu`, Storage und der noch
  nicht ausgerollte App-Hosting-Backend liegen jetzt in `europe-west4`.
- Identity Platform ist aktiv: Endnutzer-Signup/-Löschung sind deaktiviert und die registrierte
  `beforeCreate`-Funktion lehnt direkte Kontoerstellung ab. Eine dedizierte Runtime-Identität ist auf
  App-Hosting-Ausführung, sechs Auth-Berechtigungen, die per Bedingung auf `primary-eu` beschränkte
  Datennutzung und ihre regionalen Secrets reduziert; die Build-Identität bleibt von App-Daten
  getrennt.
- Regionale Secret-Manager-Einträge, API-Key-Einschränkungen, eine tägliche Sieben-Tage-Sicherung
  und ein eintägiges Functions-Artefakt-Cleanup begrenzen Angriffsfläche und laufende Kosten.
- Per-IP-Limits lesen die von Google App Hosting ergänzte Client-Adresse vom vertrauenswürdigen
  rechten Ende der `X-Forwarded-For`-Kette; ein vorgeschobener Client-Wert kann das Limit nicht mehr
  umgehen.
- Der temporäre Staging-Rollout wird vor Seiten und API-Routen durch HTTP Basic geschützt. Das
  starke Passwort kommt nur aus Secret Manager, eine Fehlkonfiguration sperrt den Zugriff, und nach
  erfolgreicher Prüfung wird der Authorization-Header nicht an die Anwendung weitergereicht.
  Geschützte Antworten sind außerdem `private, no-store`, damit kein Shared Cache die Zugangskontrolle
  umgehen kann.

### Hinzugefügt

- **Selbstregistrierung mit echtem Zugang.** `/signup` führt jetzt auf drei Wegen zu einem Login.
  Ist im Eintrag eine Beratungsemail hinterlegt, geht der Anmeldelink an genau diese Adresse und der
  Zugang gilt sofort. Fehlt sie — was aktuell auf alle Verzeichnis-Einträge zutrifft —, gibt die Law
  Clinic ihre eigene Adresse an und bestätigt sie; bis zur Admin-Freigabe sieht sie nur eine
  Wartekarte. Eine neue Law Clinic legt ihren Eintrag selbst an und durchläuft denselben Weg. Damit
  ist die frühere Sackgasse „Für diesen Eintrag ist keine E-Mail-Adresse hinterlegt" geschlossen.
- **Admin-Konten unter `/admin/admins`:** Liste aller Admins mit Adresse und Status (aktiv oder
  eingeladen), Einladung weiterer Admins und Entfernen bestehender. Alle Admins haben dieselben
  Rechte. Zwei serverseitig erzwungene Sperren: Niemand entfernt das eigene Konto, und das letzte
  verbliebene Admin-Konto lässt sich nicht entfernen.
- **Wartekarte `/clinic/pending`** als einzige erreichbare Seite eines noch nicht freigegebenen
  Zugangs — durchgesetzt im Proxy, in den API-Routen (`requireActiveRole`) und in der Datenbank.
- **`NEXT_PUBLIC_SITE_URL`** setzt die Basis-URL für den `/auth/confirm`-Link in Auth-Mails, statt
  sich allein auf die Site-URL-Einstellung im Supabase-Dashboard zu verlassen.

### Geändert

- **Eine Adresse gehört genau einer Rolle.** Admin-Einladung und Clinic-Registrierung prüfen
  gegenseitig, ob die Adresse schon vergeben ist, und melden das verständlich statt als
  Datenbankfehler.
- **Das Login legt keine Konten mehr an** und läuft über eine eigene, pro IP begrenzte Route. Es
  unterscheidet jetzt bewusst eine nicht registrierte Adresse, während technische Zustellfehler
  weiterhin generisch bleiben.
- **Abgelaufene Anmeldelinks werden erklärt.** `/auth/confirm` leitete schon immer mit `?error=` auf
  das Login zurück, angezeigt wurde davon nichts — das Formular erschien einfach leer.
- **Die Freigabe-Warteschlange im Admin liegt jetzt in `clinics`** und unterscheidet „Neuer Eintrag"
  von „Übernahme". Die Tabelle `clinic_submissions` entfällt.

### Behoben

- **Der Anmeldelink führt jetzt in den Mitglieder- bzw. Admin-Bereich statt auf die Startseite.**
  Drei Ursachen lagen übereinander: `NEXT_PUBLIC_SITE_URL` war nicht gesetzt, der Helfer für die
  Bestätigungs-URL fiel serverseitig auf `window` zurück (das es in einer Route nicht gibt) und
  lieferte deshalb `null`, worauf `emailRedirectTo` entfiel — und ohne dieses Ziel leitet Supabase
  auf die Site URL, also die Startseite. Der Helfer ist jetzt serverseitig und leitet den Ursprung
  aus der Anfrage ab, wenn keine Domain konfiguriert ist. Ein Test deckt genau diesen Zweig ab, der
  vorher nur in Produktion auftrat.
- **`/auth/confirm` akzeptiert beide Linkformate.** Neben dem Token-Hash der eigenen Vorlagen jetzt
  auch Supabases Standardformat (`code`), sodass die Anmeldung selbst mit unveränderten Vorlagen
  funktioniert. Weil dieser Weg nur im anfordernden Browser klappt, wird er als Warnung protokolliert
  statt still hingenommen.

### Hinzugefügt (Auth)

- **Gestaltete Anmelde-E-Mails** in `supabase/email-templates/` (Magic Link und Invite), im
  Erscheinungsbild der Website. Sie bauen den Bestätigungslink selbst und sind die Referenzfassung
  der im Dashboard hinterlegten Vorlagen.
- **Auth-Ereignisse im Protokoll:** angeforderter und gesendeter Anmeldelink, Rate-Limit-Treffer,
  erfolgreiche Bestätigung (mit Rolle, Ziel und Linkformat), fehlgeschlagene Bestätigung mit
  unterscheidbarem Grund, Abmeldung sowie eingereichte Übernahmen und Registrierungen. Bewusst ohne
  E-Mail-Adressen — nur IDs und kurze Gründe.

### Behoben (weiterhin)

- **Das Löschen einer Law Clinic entfernt jetzt auch deren Login.** Bisher verschwand nur das
  Profil, während der `auth.users`-Datensatz als verwaistes Konto bestehen blieb. Ein Trigger auf
  `clinics` erledigt das in der Datenbank, sodass auch ein Löschen im Supabase-Dashboard oder per
  SQL greift.
- **API-Kosten je Gespräch im Admin-Drawer:** Unter „Anonymisierte Gespräche" zeigt ein geöffnetes
  Gespräch neben „Rechtsgebiet" und „Treffer" jetzt auch, was genau dieses Gespräch an LLM-Kosten
  verursacht hat – auf vier Nachkommastellen, da ein einzelner Chat weit unter einem Cent liegt.
  Für ein Modell ohne hinterlegten Preis steht dort „unbekannt" statt einer Null.
- **Abschluss- und Kein-Treffer-Zustände im Finder-Chat:** Eine strukturierte Empfehlung schließt
  den Chat mit Neustart-Aktion ab. Bei `report_no_match` erscheint „Keine Law Clinic gefunden" mit
  festen nächsten Schritten und Link zum Gesamtverzeichnis; der Nachrichteneingang bleibt in beiden
  Fällen geschlossen.
- **Umfassende Region-Vorschläge:** Das Feld „Region / Stadt" schlägt jetzt „Bundesweit", alle 16
  Bundesländer, alle 19 Regierungsbezirke (präfigiert, z. B. „Regierungsbezirk Köln") und alle 79
  deutschen Großstädte vor. Die Liste ist die einzige Quelle für Mitglieder-, Admin- und
  Signup-Formular.
- **Hindi und Panjabi als Sprach-Vorschläge:** Beide Sprachen kommen im Verzeichnis vor und stehen
  jetzt in der `LANGUAGES`-Vorschlagsliste (alphabetisch einsortiert).
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

- **„So funktioniert's" erklärt jetzt diese Website statt Law Clinics allgemein:** Die vier
  Schritte führen von der Beschreibung des Problems über die anonymisierte KI-Auswertung und den
  Abgleich mit den Beratungsvoraussetzungen bis zum Vorschlag der passenden Law Clinic.
- **Häufige Fragen erklären studentische Rechtsberatung:** Sieben Einträge statt fünf – neu sind
  „Was ist eine Law Clinic?", „Wer berät mich – und wer prüft das Ergebnis?", „Warum beraten
  Studierende überhaupt?" und „Wem hilft studentische Rechtsberatung?"; Kosten, Vertraulichkeit und
  Vertretung vor Gericht bleiben unverändert. Die Frage nach mitzubringenden Unterlagen entfällt.
- **KI-Hinweis direkt neben dem Suchbutton:** Vor dem Absenden steht jetzt in der Buttonzeile, dass
  die Anfrage anonymisiert von einer KI bearbeitet wird, keine personenbezogenen Informationen in
  den Chat gehören und die KI keine Rechtsberatung durchführt. Er ersetzt den bisherigen
  Datenschutzhinweis unter dem Textfeld.
- **Neuer Platzhalter im Suchfeld:** Statt eines ausformulierten Beispielfalls bittet er um eine
  möglichst genaue Schilderung samt Wohnort und Angaben zur eigenen Person.
- **Neue Landing-Texte bleiben in jeder Sprache deutsch:** Die vier Schritte, die neuen
  FAQ-Einträge, der KI-Hinweis und der Suchfeld-Platzhalter werden bewusst nicht übersetzt und
  erscheinen in allen 9 Sprachen wörtlich auf Deutsch.
- **Der Chat füllt den Bildschirm, sobald er begonnen hat:** Aus der kleinen Karte mit fest
  begrenztem Nachrichtenfenster wird ein bildschirmhohes Panel, das sich beim Öffnen unter die
  Navigation schiebt — deutlich mehr Gesprächsverlauf auf einen Blick, mit „Law Clinic Finder" als
  Titelzeile und dem Eingabefeld fest am unteren Rand. Überschrift und Untertitel der Startseite
  bleiben in unveränderter Größe darüber und sind durch Hochscrollen weiterhin sichtbar; die
  Suchkarte vor der ersten Nachricht bleibt wie bisher.
- **Sprachbedarf ohne Stellvertretungs-Rückfrage:** Der Chatbot leitet die benötigte
  Beratungssprache ausschließlich aus der Chat-Sprache ab und fragt nicht mehr danach, ob für die
  Person selbst oder jemand anderen gesucht wird.
- **Rechtsgebiets-Passung des Chatbots neu kalibriert:** Der Assistent ordnet konkrete
  Sachverhalte jetzt allgemeinen, im Verzeichnis vorhandenen Rechtsgebieten zu, statt neue enge
  Bezeichnungen aus ihrem Kontext abzuleiten. Clinics werden bei geringen oder mittleren Zweifeln
  an dieser inhaltlichen Passung empfohlen (bei mittleren mit Prüfhinweis), bei hohen Zweifeln nicht.
  Die Zweifelsskala gilt ausschließlich für das Rechtsgebiet; passt keines der in der Datenbank
  vorhandenen Rechtsgebiete ausreichend, darf der Bot nach den vorgeschriebenen Suchen ausdrücklich
  einen Kein-Treffer-Zustand ausgeben.
- **Anfragelimit sperrt neue Chats sichtbar:** Die 429-Meldung heißt jetzt „Anfragelimit erreicht"
  und deaktiviert Eingabe sowie Startaktionen. Ein Minutenlimit wird nach dem Serverfenster wieder
  freigegeben, ein Tageslimit bleibt gesperrt.
- **Empfehlungs-PDF im Finder:** Der Download folgt wieder dem kompakten einseitigen Layout mit
  Wortmarke, Anliegen-Karte, schlanken Empfehlungskarten und QR-Footer. In der Anliegen-Karte steht
  ausschließlich die erste Nachricht der ratsuchenden Person; der Text-Export behält weiterhin alle
  eingegebenen Angaben.
- **Chatbot strikt an das Verzeichnis gebunden:** Eine verpflichtende, per RLS auch vor direkten
  authentifizierten Admin-Schreibzugriffen geschützte DB-Einstellung untersagt Tatsachen aus
  vortrainiertem Modellwissen. Der Server
  bietet genau die vier dokumentierten Tools an, weist unbekannte Tool-Namen ab und akzeptiert für
  Empfehlungen nur Clinic-IDs, die `search_clinics` im selben Gespräch tatsächlich geliefert hat;
  die „kein Treffer"-Karte setzt zwei erfolgreiche Datenbanksuchen voraus.
- **KI- und Datenbankgrenzen gehärtet:** Das Suchwerkzeug des Chat-Modells erhält keine
  Beratungsemail-Adressen mehr; diese werden nur bei einer konkreten, serverseitig geprüften
  Empfehlungskarte ausgegeben. Eine neue Supabase-Migration entzieht `clinics.contact_email` auch
  angemeldeten REST-Clients, vergibt Tabellen- und Funktionsrechte nach dem Least-Privilege-Prinzip
  explizit und schützt die privilegierten Aufräum- und Gesprächsfunktionen vor Search-Path-Hijacking.
  Der ältere Snapshot `clinics_backup_20260726` ist zusätzlich vollständig von Web- und
  Service-Rollen abgeschottet und erzwingt RLS ohne Richtlinie.
- **Next.js-Sicherheitsupdate:** Next.js und `eslint-config-next` wurden auf `16.2.12` aktualisiert,
  den aktuell verfügbaren Patchstand der verwendeten 16.2-Reihe. Gepinnte transitive
  Sicherheitsupdates für PostCSS und Sharp schließen die von Next.js noch gebündelten
  Runtime-Schwachstellen, bis Next.js diese Versionen selbst bezieht.
- **Admin-E-Mail-Wechsel als sichere Zugangsübertragung:** Die Kontoansicht erklärt jetzt, dass
  derselbe Auth-User samt Admin-Rolle nach Bestätigung auf die neue Adresse übertragen wird. Der
  bestehende Dual-Confirmation-Aufruf ist durch einen API-Routentest abgesichert.

- **Deterministische Chat-Redaktion ohne KI-Aufruf:** Personenbezogene Angaben werden jetzt lokal
  vor dem Chat-Modell und erneut vor dem Speichern redigiert. Die Regeln erkennen zusätzlich Namen
  in eindeutigen Kontexten, deutsche Straßenanschriften und IBANs; die bisherige separate
  Anthropic-Anfrage samt Redaktions-Prompt entfällt vollständig. Rechtsgebiet und Stadt für die
  Statistik werden lokal gegen kontrollierte Begriffslisten erkannt.
- **Vereinheitlichte Verzeichnis-Daten:** Die Freitextfelder der Law Clinics (Region, Rechtsgebiete,
  Mandant:innen, Sprachen) wurden auf die kontrollierten Vorschlagslisten aus `options.ts`
  normalisiert – Sprach-Kürzel zu vollen Namen (`DE` → `Deutsch`), Synonyme auf die Vorschläge
  (`Gesellschaftsrecht` → `Handels- & Gesellschaftsrecht`, `Asylrecht` → `Asyl- & Migrationsrecht`),
  Zusätze zur Zugangsberechtigung in `Mandant:innen`/`Voraussetzungen` verschoben. Werte ohne passenden
  Vorschlag bleiben unverändert. So arbeitet der Chatbot mit einem einheitlicheren Suchvokabular.
- **Durchgängig informelle Anrede in allen Sprachen:** Jede Sprache mit einer Höflichkeitsunterscheidung
  (T-V) spricht Ratsuchende jetzt ausschließlich informell an – analog zum deutschen „du". Betroffen sind
  Französisch (vous → tu), Russisch (вы → ты), Ukrainisch (ви → ти), Türkisch (formelles -ınız → 2. Person
  Singular), Persisch (شما → تو) und Kurdisch (eine verbliebene förmliche Stelle korrigiert). Arabisch und
  Englisch kennen keine solche Pronomen-Unterscheidung und bleiben unverändert. Ein neuer Test
  (`locales/register.test.ts`) verhindert, dass förmliche Formen zurückkehren.
- **Veröffentlichen/Verbergen als Schalter in der Admin-Tabelle:** Die Status-Spalte zeigt statt einer
  klickbaren Statusplakette jetzt den vertrauten Ein/Aus-Schalter (`Toggle`, wie beim Chatbot-
  Kill-Switch) mit dem Zustand daneben („Veröffentlicht" / „Entwurf"). Bei einem unvollständigen
  Entwurf ist der Schalter ausgegraut und das Font-Awesome-Warnsymbol `triangle-exclamation` nennt im
  Tooltip die fehlenden Pflichtfelder; während des Speicherns ist der Schalter kurz deaktiviert, um
  Doppelklicks zu verhindern. Die frühere Plakette gab keinen Hinweis darauf, dass sie klickbar war.
- **Fixierte Kopfzeile und Namensspalte in der Admin-Datenbanktabelle:** Beim vertikalen Scrollen
  bleibt die Kopfzeile (Name … Sprache, Zugang, Status) sichtbar, beim horizontalen Scrollen bleibt
  die Spalte „Name" fixiert — so ist stets erkennbar, welche Law Clinic eine Zeile betrifft.
- **Clinic-Zugang zurücksetzen:** Der frühere Text-Button „Zugang entziehen" ist jetzt der klar
  umrandete Button „Zugang zurücksetzen". Nach Bestätigung in einem Dialog werden der verknüpfte
  Login und die Beratungsemail des Eintrags entfernt; sein Veröffentlichungsstatus bleibt unverändert.
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
  code-seitigen Tool-Beschreibungen und die Toolbox-Referenz. Der Startwert
  wird per versionierter Supabase-Migration gesät; fehlt ein Pflichtwert oder ist er ungültig, gilt
  der Chat als nicht verfügbar statt auf Code zurückzufallen. Die frühere „override-only"-/
  Fallback-Logik in `prompts.ts` entfällt.
- Der Next.js-Dev-Indikator (das „N" unten links) ist per `devIndicators: false` ausgeblendet.

### Behoben

- **Lesbare Chat-Antworten über Tool-Aufrufe hinweg:** Antwortteile vor und nach einer
  Datenbanksuche werden beim Streamen nun mit einem Leerzeichen verbunden statt zusammenzukleben.
- **Einladungslink kann tatsächlich erneut gesendet werden:** Solange der verknüpfte Auth-User noch
  nie angemeldet war, verschickt „Link erneut senden" jetzt einen frischen Magic Link statt den
  Eintrag allein wegen des bereits angelegten Profils als aktiv abzulehnen. Die erste erfolgreiche
  Einladung oder ihr Ersatzlink setzt `profiles.activated_at` und darf eine vollständige Clinic
  genau einmal automatisch veröffentlichen; spätere Logins veröffentlichen verborgene Clinics nie.

- Der Chatbot kann Verzeichnisse mit mehr als 100 veröffentlichten Law Clinics vollständig
  durchsuchen: `search_clinics` liefert stabil sortierte Seiten samt Gesamtzahl und `next_offset`.
  Empfehlungen verwenden jetzt eindeutige Clinic-IDs, sodass gleichnamige Einträge nicht mehr zu
  einer Karte zusammenfallen.
- Die Feldhilfe `InfoHint` erzeugte ihr Tooltip-Portal beim ersten Browser-Render, aber nicht beim
  Server-Render. Dadurch konnte eine harte Navigation zur Admin-Clinic-Tabelle mit einem
  Hydration-Fehler abbrechen. Das Portal wird jetzt erst nach der Hydrierung eingebunden; ein
  SSR-zu-Client-Regressionstest sichert identisches Initial-Markup ab.
- Der Live-Chatbot nutzte einen veralteten, in der Datenbank eingefrorenen „Ablauf" und feuerte die
  „Kein Treffer"-Karte (`report_no_match`) nie; die eingefrorenen Prompt-Zeilen wurden an den
  aktuellen `prompts.ts`-Stand angeglichen.
- `npm run typecheck` schlug in einem frischen Clone fehl: `next-env.d.ts` wird von Next generiert
  und ist daher nicht eingecheckt, ohne die Datei fehlen die Typdeklarationen für Bild-Importe.
  Das Skript ruft jetzt vorab `next typegen` auf.
- Der Veröffentlichen-Schalter in der Admin-Datenbanktabelle sprang im Bearbeiten-Modus nach dem
  Umschalten zurück, weil ein noch nicht gespeicherter Entwurf ihn überlagerte. Er richtet sich jetzt
  nach dem gespeicherten Eintrag (erst speichern, dann veröffentlichen) — konsistent mit der
  Serverprüfung beim Veröffentlichen.

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
