# ASVS 5.0 L2 und AISVS 1.0 L2 — Matrix

Bewertung je Kapitel, nicht je Einzelanforderung: Die Anforderungslisten sind lang, und eine
Zeile-für-Zeile-Abschrift würde den Eindruck einer Prüftiefe erwecken, die hier nicht geleistet
wurde. Was geprüft wurde, steht als Belegstelle daneben.

**Zur Kapitelnummerierung:** Die Kapitel sind mit ihrem Titel benannt. Die Nummern der beiden
Standards wurden für dieses Dokument nicht gegen die Originaltexte abgeglichen; wer die Matrix
gegen ASVS 5.0 bzw. AISVS 1.0 prüft, sollte über die Titel gehen.

## Legende

| Status | Bedeutung                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------- |
| ✅     | Erfüllt, im Quelltext belegt und durch Tests abgesichert                                           |
| 🔧     | War nicht erfüllt, in dieser Runde behoben — Commit genannt                                        |
| 🏗️     | Hängt an einer Einstellung außerhalb des Quelltexts; Prüfkommando in `operational-verification.md` |
| ➖     | Nicht anwendbar, mit Begründung                                                                    |
| ⚠️     | Bewusst offen — siehe „Bewusst akzeptierte Restrisiken" im Bericht                                 |

---

## OWASP ASVS 5.0, Level 2

| Kapitel                             | Status | Beleg / Begründung                                                                                                                                                                                                                                              |
| ----------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encoding and Sanitization           | 🔧     | Assistententext bleibt React-Text mit einer einzigen Fettmarkierung; Verzeichnistext verliert Steuer-, Nullbreiten- und Bidi-Zeichen (`e60982b`, `ab284d8`). Keine `dangerouslySetInnerHTML` außer dem Nonce-Style-Block mit ausschließlich validierten Werten. |
| Validation and Business Logic       | ✅ 🔧  | Jeder externe Eingang läuft über ein Zod-Schema; `.strict()` auf allen Firestore-Codecs. Behoben: Schema-Prüfung der URL auf dem Lesepfad (`ab284d8`), Google-Cloud-Ressourcennamen (`9bd466c`).                                                                |
| Web Frontend Security               | ✅ 🔧  | Strikte CSP mit Nonce, `script-src 'self'`; seit `18569b8` auch `style-src` und `font-src` ohne externen Ursprung. `frame-ancestors 'none'`, `X-Frame-Options: DENY`, Same-Origin-Prüfung auf jedem schreibenden Endpunkt.                                      |
| API and Web Service                 | 🔧     | Body-Grenzen auf allen 17 Handlern plus dem Multipart-Upload (`e1f9833`); Idempotenzschlüssel auf wiederholbaren Schreibpfaden; `Cache-Control: private, no-store` auf authentifizierten Pfaden.                                                                |
| File Handling                       | ✅     | Einziger Upload ist das Branding-Logo: Größe vor `formData()` geprüft, PNG erzwungen, Zielpfad serverseitig als `branding/logo-<uuid>.png` vergeben, Storage-Regeln lassen nur öffentliches Lesen zu.                                                           |
| Authentication                      | ✅ ⚠️  | Kein eigenes Passwort-Handling — Firebase E-Mail-Link. Kein MFA für Admins (DECISION D, bewusst). Kompensiert durch kurze Admin-Sitzungen und erneute Anmeldung.                                                                                                |
| Session Management                  | 🔧     | Session-Cookie `httpOnly`, `secure`, `sameSite`, begrenzte Lebensdauer; Admin 8 h, Clinic 5 Tage (`dd436fb`). Widerruf beim Abmelden und nach E-Mail-Wechsel (`dd436fb`, `a95b404`), Prüfung mit `verifySessionCookie(cookie, true)`.                           |
| Authorization                       | ✅ 🔧  | Rollen in Custom Claims und im Profil; jede Admin-Route über eine Wache. Behoben: erneute Anmeldung für folgenreiche Aktionen (`65a3f46`), Adressnachweis vor der Freigabe (`7a12d8d`).                                                                         |
| Self-contained Tokens               | ➖     | Keine selbst ausgestellten Tokens. Session-Cookies werden von Firebase ausgestellt und serverseitig geprüft.                                                                                                                                                    |
| OAuth and OIDC                      | ➖     | Kein OAuth-/OIDC-Flow in der Anwendung.                                                                                                                                                                                                                         |
| Cryptography                        | ✅     | Keine eigene Kryptografie. Reservierungs- und Limit-Schlüssel sind SHA-256 mit Bereichstrennung; Zufall aus `node:crypto`.                                                                                                                                      |
| Secure Communication                | 🔧 🏗️  | `upgrade-insecure-requests`, HTTPS erzwungen. SMTP: Zielprüfung je Verbindung, Adress-Pinning gegen Rebinding, `rejectUnauthorized: true`, TLS-Version festgelegt (`6073bc3`). HSTS-Ausrollung: Hosting-Einstellung.                                            |
| Configuration                       | ✅ 🏗️  | Keine Sekrete im Repository; `.env` nie versioniert. `apphosting.yaml`-Werte über Zod validiert. Ob die Laufzeitidentität und die Secret-Berechtigungen wirklich so gesetzt sind, zeigt nur die Cloud.                                                          |
| Data Protection                     | 🔧     | De-Identifikation vor Modell und Speicher, jetzt regional in `europe-west4` (`335e552`); zentrale Log-Maskierung (`bf17a75`); Verzeichnisexport über die Signup-Suche geschlossen (`9555415`); Branding-Schriften selbst gehostet (`18569b8`).                  |
| Secure Coding and Architecture      | ✅ 🔧  | Reine Logik von Speicherzugriff getrennt; Transaktionen lesen ihre Vorbedingungen erneut (`c771da1`). Lieferkette: gepinnte Action-SHAs, Dependabot für drei Ökosysteme, Audit ohne Dev-Abhängigkeiten in CI (`a028da2`).                                       |
| Security Logging and Error Handling | 🔧     | Strukturierte JSON-Logs mit Request-ID; Maskierung an der Logger-Grenze statt an über 100 Aufrufstellen (`bf17a75`). Nach außen generische Meldungen, Details nur serverseitig.                                                                                 |
| WebRTC                              | ➖     | Kein WebRTC.                                                                                                                                                                                                                                                    |

---

## OWASP AISVS 1.0, Level 2

Die Anwendung nutzt ein fremdgehostetes Modell über eine API. Sie trainiert nicht, tunt nicht und
betreibt weder Vektorspeicher noch Embeddings — mehrere Kapitel entfallen deshalb vollständig.

| Kapitel                                   | Status | Beleg / Begründung                                                                                                                                                                                                                                   |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Training Data Governance                  | ➖     | Es wird kein Modell trainiert oder feingetunt.                                                                                                                                                                                                       |
| User Input Validation                     | 🔧     | Nachrichtenzahl, -länge und Body-Größe begrenzt (`e1f9833`); De-Identifikation läuft **vor** der Kontingentbuchung, damit ein Ausfall keine Tagesnachricht verbraucht (`335e552`).                                                                   |
| Model Lifecycle Management                | ➖     | Kein eigenes Modell im Lebenszyklus. Das Anbietermodell ist in der Konfiguration festgelegt.                                                                                                                                                         |
| Infrastructure, Configuration, Deployment | ✅ 🏗️  | Serverseitiger Schlüssel, nie im Client. Fehlende oder ungültige Konfiguration macht den Chat nicht verfügbar, statt still weiterzulaufen.                                                                                                           |
| Access Control and Identity               | ✅     | Der Chat ist öffentlich, hat aber Same-Origin-Prüfung, Burst-Grenze, Challenge vor der ersten Nachricht und ein Tageskontingent je Sitzung.                                                                                                          |
| Supply Chain Security                     | ✅     | Ein Anbieter-SDK, exakt gepinnt; Lockfile-Integrität und Audit in CI (`a028da2`).                                                                                                                                                                    |
| Model Behavior and Output Handling        | 🔧     | Tool-Ausgabe in benannter Datenhülle, deren Trennzeichen der Inhalt nicht schließen kann; unveränderliche Anweisung „ausschließlich Daten" im code-eigenen Teil (`e60982b`). Ausgabepfad erneut validiert, Bidi entfernt, Länge gekürzt (`ab284d8`). |
| Memory, Embeddings, Vector Stores         | ➖     | Keine Embeddings, kein Vektorspeicher, kein sitzungsübergreifendes Gedächtnis.                                                                                                                                                                       |
| Autonomous Orchestration, Agentic Action  | ✅     | Nur registrierte Tools mit Zod-Eingaben; jede Empfehlung wird über die gesuchte ID aus der Datenbank nachgeladen, sodass eine halluzinierte Clinic die Anzeige nicht erreicht. Tool-Züge sind gedeckelt.                                             |
| Adversarial Robustness                    | 🔧     | Prompt-Injection-Fixtures für Verzeichnistext (`e60982b`) und für den Renderpfad: HTML, `javascript:`, `data:`, `blob:`, `mailto:`-Parameter, Bidi-Spoofing, Überlänge, zwei im Assistententext gefälschte Frames (`ab284d8`).                       |
| Privacy Protection                        | 🔧 ⚠️  | Cloud DLP als alleiniger Redaktor, fehlschlagend schließend (`335e552`). Postleitzahl und Ort bleiben dreifach geschützt erhalten. Bewusst ohne Erkennung: vier deutsche Kategorien — siehe Bericht.                                                 |
| Monitoring, Logging, Anomaly Detection    | ✅ 🏗️  | Chatereignisse strukturiert protokolliert, ohne Inhalt; Betriebsalarme über eine Cloud Function. Ob die Alarme wirklich zugestellt werden, zeigt nur die Cloud.                                                                                      |
| Human Oversight and Accountability        | ✅     | Hinweis „Du interagierst gerade mit einer künstlichen Intelligenz." unter dem Eingabefeld, in allen neun Sprachen (EU-KI-VO Art. 50). Verläufe sind im Admin einsehbar und löschbar; Rolle und Ablauf sind dort redigierbar.                         |
