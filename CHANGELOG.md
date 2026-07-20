# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

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
