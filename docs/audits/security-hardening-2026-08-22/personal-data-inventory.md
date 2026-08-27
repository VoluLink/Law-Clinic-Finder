# Verzeichnis der personenbezogenen Daten

Grundlage für die Datenschutzerklärung und für Art. 30 DSGVO. Jede Zeile ist am Quelltext geprüft;
die Aufbewahrungsfristen stammen aus den Konstanten, nicht aus der Dokumentation.

**Wichtig:** Die Fristen unten sind die im Code gesetzten `expiresAt`-Werte. Firestore löscht sie
nur, wenn die TTL-Richtlinie für das jeweilige Feld im Projekt auch **aktiviert** ist — das ist eine
Cloud-Einstellung, kein Codepfad. Prüfkommandos in [operational-verification.md](operational-verification.md).

---

## 1 — Besucherinnen und Besucher der Beratungssuche

| Datum                          | Zweck                          | Herkunft                     | Empfänger                        | Aufbewahrung          |
| ------------------------------ | ------------------------------ | ---------------------------- | -------------------------------- | --------------------- |
| Chatnachrichten (Freitext)     | Passende Law Clinic finden     | Eingabe                      | Google Cloud DLP, dann Anthropic | 90 Tage (Transkript)  |
| Postleitzahl und Ort im Text   | Örtlich passende Clinic finden | Eingabe                      | Anthropic                        | 90 Tage               |
| Erkanntes Rechtsgebiet, Ort    | Statistik im Admin             | Ableitung aus dem Transkript | —                                | 366 Tage              |
| Nachrichtenanzahl, Tokenzahlen | Kostenkontrolle                | Ableitung                    | —                                | 366 Tage              |
| Sitzungs-ID (zufällig)         | Tageskontingent durchsetzen    | erzeugt                      | —                                | bis Kontingentablauf  |
| IP-Adresse                     | Missbrauchsgrenzen             | Verbindung                   | —                                | **nicht gespeichert** |

**Zur IP-Adresse:** Sie wird für die prozesslokale Grenze im Speicher gehalten und für die dauerhafte
Grenze nur als **Hash eines /24- bzw. /48-Präfixes** abgelegt (`c2ed12e`). Weder die Adresse selbst
noch das Präfix im Klartext erreichen Firestore.

**Zu DLP:** Google Cloud Sensitive Data Protection ist seit `335e552` alleiniger Redaktor und damit
**Auftragsverarbeiter für Chatinhalte**. Die Verarbeitung läuft in `europe-west4`; vorher ging die
Anfrage an den globalen Endpunkt. Dieser Eintrag fehlt der Datenschutzerklärung noch.

**Was DLP nicht erkennt:** verschleierte E-Mail-Adressen, Sozialversicherungsnummern, Aktenzeichen
und deutsche Kfz-Kennzeichen. Steht so etwas im Text, erreicht es Anthropic und Firestore im
Klartext. Bewusst so entschieden — siehe Bericht.

**Was absichtlich erhalten bleibt:** Postleitzahl und Ort. Der Assistent braucht beides, um die
örtlich zuständige Clinic zu finden. Dreifach abgesichert: keine Orts-infoTypes angefragt, eine
Ausschlussregel hält `PERSON_NAME` vom Ortsvokabular fern, und eine Nachbedingung weist eine Antwort
zurück, die trotzdem einen Ort entfernt hat.

---

## 2 — Clinic-Mitarbeitende

| Datum                              | Zweck                                | Herkunft            | Empfänger       | Aufbewahrung                  |
| ---------------------------------- | ------------------------------------ | ------------------- | --------------- | ----------------------------- |
| E-Mail-Adresse (Login und Kontakt) | Anmeldung, Benachrichtigung, Anzeige | Eingabe / Einladung | Firebase, Brevo | bis zur Löschung des Kontos   |
| Hash der Adresse (`emailOwners`)   | Eindeutigkeit sicherstellen          | Ableitung           | —               | bis zur Löschung durch Admin  |
| Auth-Identität (uid)               | Anmeldung                            | Firebase            | Firebase        | bis zur Löschung durch Admin  |
| Anmeldezeitpunkt                   | Abläufe steuern                      | Firebase            | —               | Kontolaufzeit                 |
| Öffentliche Clinic-Angaben         | Verzeichniseintrag                   | Eingabe             | öffentlich      | bis zur Löschung des Eintrags |

**Achtung, unbegrenzte Speicherung:** Ein Antrag, der nie beantwortet wird, behält seine
Reservierungen — Profil, Namens-, Adress- und Eigentümerreservierung sowie den unbestätigten
Auth-Nutzer — bis eine Administratorin ihn löscht. Die Adresse einer Person, die nie geantwortet
hat, bleibt damit unbegrenzt gespeichert. Ein Ablauf nach sieben Tagen war implementiert und wurde
auf Anweisung wieder entfernt; siehe [README.md](README.md) §2.1. Für die Datenschutzerklärung und
für Löschanfragen ist das die Zeile, die abweicht: überall sonst gibt es eine Frist.

---

## 3 — Administratorinnen und Administratoren

| Datum                | Zweck                       | Herkunft  | Empfänger       | Aufbewahrung             |
| -------------------- | --------------------------- | --------- | --------------- | ------------------------ |
| E-Mail-Adresse       | Anmeldung                   | Einladung | Firebase, Brevo | bis zum Entzug der Rolle |
| Sitzungscookie       | Angemeldet bleiben          | Server    | —               | 8 Stunden (`dd436fb`)    |
| `authTime` im Cookie | Erneute Anmeldung erzwingen | Firebase  | —               | Sitzungsdauer            |

---

## 4 — Protokolle

| Datum                              | Zweck       | Aufbewahrung |
| ---------------------------------- | ----------- | ------------ |
| Strukturierte Anwendungsprotokolle | Fehlersuche | 7 Tage       |

Seit `bf17a75` maskiert ein zentraler Filter an der Logger-Grenze sekret- und adressartige Felder,
statt sich auf über 100 einzelne Aufrufstellen zu verlassen. Der Filter greift für beide Senken —
stdout und Firestore. Kein Request-Body, kein Chattext, keine SMTP-Zugangsdaten, keine
Aktionscodes, keine Sitzungscookies.

---

## 5 — Analyse

Google Analytics 4 lädt **nur nach Einwilligung**. Ohne Einwilligung wird das Skript gar nicht
eingebunden, und der Consent-Modus startet mit `analytics_storage: 'denied'` für alle vier Kategorien.

Seit `18569b8` ist Google Fonts vollständig entfallen: Es gibt keinen Ladevorgang mehr, der die IP
eines Besuchers ohne Einwilligung an Google überträgt.

---

## 6 — Auftragsverarbeiter

| Empfänger               | Wofür                                    | Ort            | In der Datenschutzerklärung? |
| ----------------------- | ---------------------------------------- | -------------- | ---------------------------- |
| Google Cloud (Firebase) | Hosting, Datenbank, Auth, Storage        | `europe-west4` | ja                           |
| Google Cloud DLP        | De-Identifikation von Chatinhalten       | `europe-west4` | **nein — fehlt noch**        |
| Anthropic               | Modellantworten                          | USA            | ja                           |
| Brevo                   | Versand von Auth- und Hinweismails       | EU             | ja                           |
| Google Analytics 4      | Reichweitenmessung, nur mit Einwilligung | —              | ja                           |

---

## 7 — Betroffenenrechte

- **Auskunft und Löschung Clinic-Konto:** Über den Clinic-Bereich; entzieht Zugang, gibt die
  Reservierungen frei und löscht den Auth-Nutzer.
- **Chatverläufe:** Laufen nach 90 Tagen (Transkript) bzw. 366 Tagen (Statistik) ab und lassen sich
  im Admin einzeln oder gesammelt löschen. Ein Verlauf enthält keine Kennung, über die eine
  Besucherin sich selbst identifizieren könnte — eine gezielte Einzelauskunft ist deshalb weder
  möglich noch nötig.
- **Einwilligung Analyse:** Über das Consent-Banner jederzeit widerrufbar.
