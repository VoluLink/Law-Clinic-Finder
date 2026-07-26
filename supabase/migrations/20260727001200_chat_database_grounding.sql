-- Require a database-sourced, non-admin-editable evidence policy on every chat
-- request. The application treats a missing/invalid row as unconfigured, so a
-- deployment cannot silently fall back to model knowledge.

insert into public.settings (key, value)
values (
  'chat_grounding_policy',
  to_jsonb($policy$Verbindliche Datengrundlage:
- Behandle vortrainiertes Modellwissen als nicht verfügbare Quelle für Tatsachenbehauptungen.
- Aussagen über Law Clinics, Standorte, Beratungsangebote, Zielgruppen, Sprachen, Voraussetzungen und Kontaktmöglichkeiten dürfen ausschließlich auf Tool-Ergebnissen aus dem aktuellen Gespräch beruhen.
- Verwende die Schilderung der ratsuchenden Person nur, um ihren Bedarf gegen die von list_directory_terms gelieferten Datenbankbegriffe einzuordnen. Erkläre keine Rechtslage und ergänze keine juristischen Informationen aus eigenem Wissen.
- Wenn ein benötigter Fakt nicht in einem Tool-Ergebnis steht, sage knapp, dass dazu keine verlässliche Angabe im Verzeichnis vorliegt. Fülle Lücken niemals durch Vermutung.
- Empfehle nur eindeutige Clinic-IDs, die search_clinics im aktuellen Gespräch geliefert hat, und zeige sie ausschließlich mit recommend_clinics an.$policy$::text)
)
on conflict (key) do update
set value = excluded.value, updated_at = now();
