# Security-Härtung 2026-08-22 — Index

Ergebnis der Sicherheitsüberprüfung, die am 22.08.2026 begonnen und am 27.08.2026 abgeschlossen
wurde. Geprüft wurde der Stand nach der Migration von Supabase zu Firebase.

| Datei                                                      | Inhalt                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| [README.md](README.md)                                     | Bericht: Befunde, Behebungen, bewusst akzeptierte Restrisiken             |
| [asvs-aisvs-matrix.md](asvs-aisvs-matrix.md)               | OWASP ASVS 5.0 L2 und AISVS 1.0 L2 — Kapitel für Kapitel mit Belegstelle  |
| [personal-data-inventory.md](personal-data-inventory.md)   | Welche personenbezogenen Daten wo entstehen, wohin sie fließen, wie lange |
| [coverage-appendix.md](coverage-appendix.md)               | Welche Dateigruppen wie geprüft wurden, inklusive bestätigter Fehlalarme  |
| [operational-verification.md](operational-verification.md) | Nur lesende Kommandos für das, was der Quelltext nicht beweisen kann      |

## Kurzfassung

21 Commits, keiner davon gepusht. Alle Gates grün: `typecheck`, 1534 Tests (41 übersprungen, weil
sie Emulatoren brauchen), `lint`, `format:check`, `build`, Functions-Tests und -Build,
Firestore-Regeltests, Emulator-Integrationstests, `npm audit --omit=dev` für beide Bäume.

Die schwerwiegendsten behobenen Punkte:

1. Die Freigabe eines Clinic-Zugangs prüfte nicht, ob die Adresse jemals bestätigt wurde.
2. Kein einziger Endpunkt begrenzte die Größe des Request-Bodys, bevor er ihn puffert.
3. Die De-Identifikation ging an den **globalen** DLP-Endpunkt, verarbeitete also außerhalb der EU.
4. Die Branding-Schriftart lud ein Stylesheet von Google und übermittelte damit die IP jedes
   Besuchers.

Der schwerwiegendste Befund der Prüfung ist **nicht** behoben, sondern auf Anweisung als Restrisiko
angenommen: Ein nie bestätigter Antrag reserviert Clinic-Name, E-Mail-Adresse, Eigentümerplatz und
Auth-Identität dauerhaft. Begründung und verbleibende Schutzmaßnahmen in
[README.md](README.md) §2.1.

Was noch offen ist, steht in [README.md](README.md) unter „Offene Punkte" — insbesondere die
Cloud-Schritte, die nur die Eigentümerin ausführen kann, und die **vor dem Livegang zwingende**
Aktivierung der DLP-API.
