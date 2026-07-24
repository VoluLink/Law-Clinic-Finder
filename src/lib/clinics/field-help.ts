import type { ClinicEditable } from './schema';

/**
 * Explainer texts shown in the info-icon tooltip next to each clinic field, in
 * the admin Datenbank, the member portal, and the signup form. One source for
 * all three surfaces — editing a text here updates it everywhere. `website` is
 * intentionally absent (self-explanatory, so it carries no hint).
 */
export const FIELD_HELP: Partial<Record<keyof ClinicEditable, string>> = {
  name: 'Der offizielle Name der Law Clinic, wie er im Vereinsregister steht. Hat eine bundesweit aktive Law Clinic unterschiedliche Beratungskriterien je nach Standort, so kann sich jeder Standort einzeln anmelden und den Standort als „(Standort)“ am Ende des Namens hinzufügen.',
  contact_email:
    'Die E-Mail-Adresse, unter der Ratsuchende die Clinic erreichen. Sie wird zugleich als Anmelde-Adresse für das Mitgliederportal dieser Webseite verwendet.',
  region:
    'Die Stadt und/oder Region, in der die Clinic beratend tätig ist. „Bundesweit“ für standortunabhängige (z. B. rein digitale) Angebote.',
  legal_areas: 'Die Rechtsgebiete, zu denen die Clinic Mandanten berät.',
  target_clients:
    'Die Personengruppen, an die sich das Beratungsangebot richtet (z. B. Studierende, Geflüchtete, Ehrenamtliche).',
  languages: 'Die Sprachen, in denen eine Beratung angeboten wird.',
  advises_clients:
    'Ob die Clinic Einzelfälle berät (Ja) oder ausschließlich andere Leistungen wie z. B. Recherchearbeit oder Forschung anbietet (Nein).',
  description:
    'Falls keine Einzelfallberatung angeboten wird, eine Beschreibung der angebotenen Tätigkeit für Mandanten.',
  requirements:
    'Weitere Voraussetzungen oder Ausschlusskriterien für eine Beratung (z. B. Einkommensgrenzen der Mandanten, keine Vertretung vor Gericht, benötigte Unterlagen, keine Fristsachen).',
};
