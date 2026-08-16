# Auth-Mailvorlagen

Diese Dateien sind die **Referenzfassung** der Anmelde-E-Mails. Ausgeliefert werden sie nicht von
hier: Supabase verschickt die im Dashboard hinterlegten Vorlagen. Der Ablauf ist deshalb „hier
ändern, dann ins Dashboard kopieren" — und beim Zurückändern umgekehrt, damit beide Seiten nicht
auseinanderlaufen.

| Datei             | Dashboard-Vorlage | Wofür                                              |
| ----------------- | ----------------- | -------------------------------------------------- |
| `magic-link.html` | **Magic Link**    | Anmeldung über `/login`                            |
| `invite.html`     | **Invite user**   | Registrierung, Eintrags-Übernahme, Admin-Einladung |

Einfügen unter **Authentication → Emails → Templates** im Supabase-Dashboard.

## Warum der Link so aussieht, wie er aussieht

Beide Vorlagen bauen die URL selbst:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink
```

Supabase erzeugt nur das Token, nicht das Ziel. Die Standardvorlage nutzt `{{ .ConfirmationURL }}`,
das über Supabases eigenen `/auth/v1/verify`-Endpunkt läuft und danach auf die **Site URL**
weiterleitet — also auf die Startseite, nicht auf `/auth/confirm`. Die Sitzung käme dabei als
URL-Fragment zurück, das nur clientseitiges JavaScript lesen kann; diese Anwendung arbeitet aber mit
Server-Cookies. Genau deshalb schreibt der Supabase-SSR-Leitfaden die Umstellung auf
`{{ .TokenHash }}` vor.

`/auth/confirm` akzeptiert beide Formen. Kommt ein Link im Standardformat an, funktioniert die
Anmeldung trotzdem, es landet aber eine Warnung in `/admin/logs` — Hinweis darauf, dass eine Vorlage
noch nicht umgestellt ist. Der Standardlink funktioniert nur im selben Browser, in dem er angefordert
wurde; die Token-Hash-Variante auch auf einem anderen Gerät.

## Nötige Projekteinstellungen

- **Site URL** muss auf die öffentliche Adresse zeigen. `{{ .SiteURL }}` in den Vorlagen folgt ihr
  automatisch, eine Domain steht deshalb in keiner Vorlage fest verdrahtet.
- **Redirect-Allowlist** braucht `<Site URL>/auth/confirm` (für lokale Tests zusätzlich
  `http://localhost:3000/auth/confirm`).
- **Gültigkeitsdauer:** Die Vorlagen nennen **15 Minuten**. Das ist nicht der Supabase-Standard
  (60 Minuten) — unter **Authentication → Sign In / Providers → Email → Email OTP Expiration** auf
  `900` Sekunden setzen, sonst steht in der Mail eine falsche Angabe.
- **Absender** (Name und Adresse) stammt aus der SMTP-Konfiguration, nicht aus diesen Vorlagen.

## Gestaltung

Farben und Radien entsprechen den Tokens aus `src/app/globals.css` (`--primary` `#0d4b5b`,
`--accent` `#f0e6d2`, `--muted` `#52707a`, `--muted-soft` `#7a949b`, `--radius-lg` `14px`). Sie
stehen hier als Rohwerte, weil E-Mail-Clients weder CSS-Variablen noch externe Stylesheets laden —
die einzige Stelle im Projekt, an der das Duplizieren von Designwerten unvermeidbar ist. Ändert sich
ein Token, müssen diese beiden Dateien von Hand nachgezogen werden.

Aus demselben Grund: Tabellen-Layout statt Flexbox, das Funkelsymbol als Textzeichen statt als SVG
(Outlook entfernt eingebettetes SVG), und Schriftgrößen in `px`. Die Hausschrift wird nicht geladen;
`Hanken Grotesk` greift nur, wenn sie lokal installiert ist, sonst folgt der System-Fallback.
