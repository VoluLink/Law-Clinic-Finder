# Betriebsprüfung außerhalb des Quelltexts

Was der Quelltext nicht beweisen kann: welche IAM-Rollen wirklich vergeben sind, ob eine
TTL-Richtlinie aktiv ist, ob ein Index ausgerollt wurde, ob Backups laufen. Diese Datei sammelt die
Kommandos, die das zeigen.

**Alle Kommandos hier sind nur lesend.** Keines legt etwas an, ändert etwas oder löscht etwas.
Keines lädt ein Sekret herunter oder gibt Nutzerdaten aus. Nichts davon wurde im Rahmen dieser
Prüfung ausgeführt — Cloud-Änderungen und -Zugriffe sind Sache der Eigentümerin (G-5).

Voraussetzungen: `gcloud` und `firebase` angemeldet, Projekt `law-clinic-finder`.

```bash
export PROJECT=law-clinic-finder
export REGION=europe-west4
export DATABASE=primary-eu
export RUNTIME_SA=law-clinic-runtime@$PROJECT.iam.gserviceaccount.com
```

---

## 1 — Vor dem Livegang zwingend: DLP

Solange das hier nicht stimmt, antwortet der Chat mit 503, weil `apphosting.yaml`
`REDACTION_PROVIDER=dlp` setzt und die De-Identifikation fehlschlagend schließt.

```bash
# Ist die API aktiviert?
gcloud services list --enabled --project "$PROJECT" | grep dlp.googleapis.com

# Hat die Laufzeitidentität die Rolle dlp.user?
gcloud projects get-iam-policy "$PROJECT" \
  --flatten="bindings[].members" \
  --filter="bindings.members:$RUNTIME_SA AND bindings.role:roles/dlp.user" \
  --format="value(bindings.role)"
```

Danach die Ende-zu-Ende-Prüfung aus dem Repository — sie schickt genau die Anfrage, die die Laufzeit
schickt, mit einem erfundenen Satz ohne echte personenbezogene Daten:

```bash
npm run dlp:check
```

---

## 2 — Laufzeitidentität und Berechtigungen

```bash
# Welche Identität benutzt der App-Hosting-Backend?
gcloud beta run services describe web --region "$REGION" --project "$PROJECT" \
  --format="value(spec.template.spec.serviceAccountName)"

# Alle Rollen dieser Identität — Ziel: so wenige wie möglich.
gcloud projects get-iam-policy "$PROJECT" \
  --flatten="bindings[].members" \
  --filter="bindings.members:$RUNTIME_SA" \
  --format="table(bindings.role)"
```

---

## 3 — Secret Manager

Zugriffsrichtlinie prüfen, ohne den Inhalt zu lesen. `versions access` wird hier bewusst **nicht**
genannt — das würde das Sekret ausgeben.

```bash
gcloud secrets list --project "$PROJECT" --format="table(name,replication.policy)"

for SECRET in smtpSettings gaServiceAccountJson; do
  echo "== $SECRET"
  gcloud secrets get-iam-policy "$SECRET" --project "$PROJECT" \
    --format="table(bindings.role,bindings.members)"
  gcloud secrets versions list "$SECRET" --project "$PROJECT" \
    --format="table(name,state,createTime)"
done
```

Erwartung: Nur die Laufzeitidentität hat `roles/secretmanager.secretAccessor`, und es gibt genau
eine aktivierte Version plus höchstens eine deaktivierte Rückfallversion.

---

## 4 — Firestore: TTL, Indizes, Regeln, Backups

Jede `expiresAt`-Frist im Code wirkt nur, wenn die TTL-Richtlinie aktiv ist.

```bash
# Aktive TTL-Richtlinien. Erwartet: authEmailStates, pendingEmailOwners,
# chatDailyQuotas, claimLimits, clinicEvents, abuseLimits, idempotencyKeys,
# conversations, conversationTranscripts, logs.
gcloud firestore fields ttls list --database="$DATABASE" --project "$PROJECT"

# Zusammengesetzte Indizes. Erwartet unter anderem:
#   clinics (approvalStatus, name)
#   profiles (accessStatus, expiresAt)   <- neu, für den Ablauf offener Anträge
gcloud firestore indexes composite list --database="$DATABASE" --project "$PROJECT"

# Löschschutz und Point-in-Time-Recovery.
gcloud firestore databases describe --database="$DATABASE" --project "$PROJECT" \
  --format="yaml(locationId,deleteProtectionState,pointInTimeRecoveryEnablement,appEngineIntegrationMode)"

# Geplante Sicherungen.
gcloud firestore backups schedules list --database="$DATABASE" --project "$PROJECT"
```

Die ausgerollten Regeln gegen die Datei im Repository halten:

```bash
firebase firestore:rules:get --project "$PROJECT" | diff - firestore.rules
```

Erwartung: kein Unterschied, und die Regel verweigert weiterhin jeden Lese- und Schreibzugriff aus
dem Browser.

---

## 5 — Storage

```bash
gcloud storage buckets describe "gs://$PROJECT.firebasestorage.app" \
  --format="yaml(location,uniform_bucket_level_access,public_access_prevention,versioning)"
```

Erwartung: Standort in der EU, einheitlicher Zugriff auf Bucket-Ebene aktiv. Öffentliches Lesen
regelt ausschließlich `storage.rules` und gilt nur für das Branding-Logo.

---

## 6 — Identity Platform

```bash
gcloud identity-platform config describe --project "$PROJECT" --format=yaml
```

Zu prüfen:

- **Blocking Function** `beforeAccountCreated` registriert — sie ist das, was Selbstregistrierung
  über die Firebase-Web-API verhindert.
- **E-Mail-OTP-Gültigkeit 900 Sekunden.** Die Vorlagen in `supabase/email-templates/` versprechen
  „15 Minuten"; die Voreinstellung ist 60 Sekunden. Passt das nicht, meldet ein Link sich zwar an,
  aber nur im anfragenden Browser, und hinterlässt eine Warnung in `/admin/logs`.
- **Autorisierte Domains** enthalten genau die Produktionsdomain.

---

## 7 — Cloud Functions

```bash
gcloud functions list --project "$PROJECT" --regions "$REGION" \
  --format="table(name,state,serviceConfig.serviceAccountEmail,eventTrigger.eventType)"
```

Erwartet: `beforeAccountCreated`, `syncOperationalAlertConfiguration`,
`restoreScheduledVisibility` — Letztere ist zum Zeitpunkt dieser Prüfung noch nicht ausgerollt.

---

## 8 — Protokollaufbewahrung

```bash
gcloud logging buckets describe _Default --location=global --project "$PROJECT" \
  --format="yaml(retentionDays,locked)"
```

Die 7 Tage für die Anwendungsprotokolle in Firestore stehen im Code; die hier ist die Frist von
Cloud Logging und davon unabhängig.

---

## 9 — Header und Weiterleitungen von außen

Nach dem Rollout gegen die echte Domain, ohne Anmeldung:

```bash
DOMAIN=https://YOUR-DOMAIN.example   # Platzhalter noch nicht ersetzt

# Sicherheitsheader auf einer öffentlichen Seite.
curl -sI "$DOMAIN/" | grep -iE 'content-security-policy|strict-transport|x-frame|referrer|x-content'

# Erwartung: keine externe Quelle mehr in style-src oder font-src.
curl -sI "$DOMAIN/" | grep -io 'fonts\.\(googleapis\|gstatic\)\.com' || echo 'keine Google-Font-Quelle — richtig'

# Authentifizierte Pfade dürfen nicht zwischengespeichert werden.
curl -sI "$DOMAIN/api/admin/clinics" | grep -i cache-control   # erwartet: private, no-store

# Die vorgelagerte Instanz muss X-Forwarded-For überschreiben; sonst ist jede
# IP-Grenze fälschbar (AR-3). Der erfundene Wert darf nirgends ankommen.
curl -sI "$DOMAIN/" -H 'X-Forwarded-For: 203.0.113.99'
```

---

## 10 — Was hiermit nicht geprüft werden kann

- **Datenschutzbedingungen bei Anthropic** — Vertragslage, kein Kommando.
- **TLS und Domain-Ausrichtung bei Brevo** — im Brevo-Dashboard (SPF, DKIM, DMARC).
- **Ob eine Sicherung sich wiederherstellen lässt.** `backups schedules list` zeigt nur, dass
  gesichert wird. Eine ungetestete Sicherung ist keine Sicherung (VS-15) — einmal pro Quartal in ein
  Wegwerf-Projekt zurückspielen.
