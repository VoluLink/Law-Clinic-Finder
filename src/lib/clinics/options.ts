/**
 * Controlled vocabularies for the guided clinic-entry inputs, plus the helpers
 * that reconcile them with the free-text `;`-joined storage format. This is the
 * single source every entry surface (member form, admin editor, public signup)
 * consumes — options are suggestions, custom values stay allowed.
 */

/** German Rechtsgebiete offered as suggestions, alphabetically ordered (de). */
export const LEGAL_AREAS = [
  'Abstammungsrecht',
  'Agrarrecht',
  'Antidiskriminierungsrecht',
  'Arbeitsrecht',
  'Arzthaftungsrecht',
  'Asyl- & Migrationsrecht',
  'Aufenthaltsrecht',
  'Ausländerrecht',
  'Bank- & Kapitalmarktrecht',
  'Bau- & Architektenrecht',
  'Beamtenrecht',
  'Betreuungsrecht',
  'Datenschutzrecht',
  'Erbrecht',
  'Europarecht',
  'Familienrecht',
  'Gewerblicher Rechtsschutz',
  'Grundgesetz und Grundrechte',
  'Handels- & Gesellschaftsrecht',
  'Insolvenzrecht',
  'Internationales Wirtschaftsrecht',
  'IT-Recht',
  'Jugendstrafrecht',
  'Kaufrecht',
  'Kindschaftsrecht',
  'Kommunalrecht',
  'Luftrecht',
  'Maklerrecht',
  'Markenrecht',
  'Medizinrecht',
  'Mietrecht',
  'Nachbarrecht',
  'Namensrecht',
  'Öffentliches Recht',
  'Patentrecht',
  'Pflegerecht',
  'Polizeirecht',
  'Presserecht',
  'Reiserecht',
  'Schadensersatzrecht',
  'Schulrecht',
  'Schwerbehindertenrecht',
  'Sozialrecht',
  'Staatsangehörigkeitsrecht',
  'Steuerrecht',
  'Strafrecht',
  'Tierrecht',
  'Umweltrecht',
  'Urheberrecht',
  'Verbraucherrecht',
  'Verfassungsrecht',
  'Vergaberecht',
  'Verkehrsrecht',
  'Versicherungsrecht',
  'Verwaltungsrecht',
  'Völkerrecht',
  'Völkerstrafrecht',
  'Wahlrecht',
  'Weltraumrecht',
  'Wirtschaftsrecht',
  'Zivilrecht',
  'Zwangsvollstreckungsrecht',
] as const;

/** Who a clinic advises. */
export const TARGET_GROUPS = [
  'Studierende',
  'Geflüchtete',
  'Migrant:innen',
  'Verbraucher:innen',
  'Mieter:innen',
  'Arbeitnehmer:innen',
  'Gründer:innen und Start-ups',
  'Selbstständige',
  'Frauen',
  'Senior:innen',
  'Menschen mit geringem Einkommen',
  'Vereine und gemeinnützige Organisationen',
] as const;

/**
 * Consultation languages. A curated head lists the most relevant languages for
 * the audience (incl. all six official UN languages) in priority order; the
 * remaining world languages follow alphabetically (de).
 */
export const LANGUAGES = [
  'Deutsch',
  'Englisch',
  'Arabisch',
  'Chinesisch',
  'Französisch',
  'Kurdisch',
  'Persisch (Farsi)',
  'Russisch',
  'Türkisch',
  'Ukrainisch',
  'Spanisch',
  'Italienisch',
  'Polnisch',
  'Afrikaans',
  'Albanisch',
  'Amharisch',
  'Armenisch',
  'Aserbaidschanisch',
  'Bengalisch',
  'Bhutanisch',
  'Birmanisch',
  'Bislama',
  'Bosnisch',
  'Bulgarisch',
  'Chichewa',
  'Dänisch',
  'Dari',
  'Estnisch',
  'Fidschianisch',
  'Filipino',
  'Finnisch',
  'Georgisch',
  'Gilbertesisch',
  'Griechisch',
  'Guaraní',
  'Haitianisch',
  'Hebräisch',
  'Irisch',
  'Isländisch',
  'Japanisch',
  'Katalanisch',
  'Kirundi',
  'Koreanisch',
  'Kroatisch',
  'Laotisch',
  'Lateinisch',
  'Lettisch',
  'Litauisch',
  'Madagassisch',
  'Malaiisch',
  'Maledivisch',
  'Maltesisch',
  'Maori',
  'Marshallesisch',
  'Mazedonisch',
  'Mongolisch',
  'Montenegrinisch',
  'Nauruisch',
  'Ndebele',
  'Nepalesisch',
  'Niederländisch',
  'Nordsotho',
  'Norwegisch',
  'Paschtu',
  'Portugiesisch',
  'Rätoromanisch',
  'Rumänisch',
  'Samoanisch',
  'Sango',
  'Schwedisch',
  'Singhalesisch',
  'Slowakisch',
  'Slowenisch',
  'Somali',
  'Südafrikanisch',
  'Südsotho',
  'Swasi',
  'Tadschikisch',
  'Tamilisch',
  'Tetum',
  'Thailändisch',
  'Tok Pisin',
  'Tongaisch',
  'Tschechisch',
  'Tsonga',
  'Tsuana',
  'Turkmenisch',
  'Tuvaluisch',
  'Ungarisch',
  'Urdu',
  'Usbekisch',
  'Venda',
  'Vietnamesisch',
  'Weißrussisch',
  'Xhosa',
  'Zulu',
] as const;

/** The reserved nationwide sentinel; it must stay first. */
const NATIONWIDE_REGION = 'Bundesweit';

/** All 16 Bundesländer, in German alphabetical order. */
const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
] as const;

/**
 * The 19 currently existing Regierungsbezirke (BW, Bayern, Hessen, NRW). Each is
 * prefixed so it never collides with a same-named city ("Regierungsbezirk Köln"
 * vs. the city "Köln") and reads unambiguously as a district.
 */
const REGIERUNGSBEZIRKE = [
  'Regierungsbezirk Stuttgart',
  'Regierungsbezirk Karlsruhe',
  'Regierungsbezirk Freiburg',
  'Regierungsbezirk Tübingen',
  'Regierungsbezirk Oberbayern',
  'Regierungsbezirk Niederbayern',
  'Regierungsbezirk Oberpfalz',
  'Regierungsbezirk Oberfranken',
  'Regierungsbezirk Mittelfranken',
  'Regierungsbezirk Unterfranken',
  'Regierungsbezirk Schwaben',
  'Regierungsbezirk Darmstadt',
  'Regierungsbezirk Gießen',
  'Regierungsbezirk Kassel',
  'Regierungsbezirk Arnsberg',
  'Regierungsbezirk Detmold',
  'Regierungsbezirk Düsseldorf',
  'Regierungsbezirk Köln',
  'Regierungsbezirk Münster',
] as const;

/** All 79 German Großstädte (≥100 000 inhabitants), by population, largest first. */
const GROSSSTAEDTE = [
  'Berlin',
  'Hamburg',
  'München',
  'Köln',
  'Frankfurt am Main',
  'Düsseldorf',
  'Leipzig',
  'Stuttgart',
  'Dortmund',
  'Bremen',
  'Essen',
  'Dresden',
  'Nürnberg',
  'Hannover',
  'Duisburg',
  'Bochum',
  'Wuppertal',
  'Bielefeld',
  'Bonn',
  'Mannheim',
  'Karlsruhe',
  'Münster',
  'Augsburg',
  'Wiesbaden',
  'Mönchengladbach',
  'Gelsenkirchen',
  'Aachen',
  'Braunschweig',
  'Kiel',
  'Chemnitz',
  'Magdeburg',
  'Freiburg im Breisgau',
  'Krefeld',
  'Halle (Saale)',
  'Mainz',
  'Erfurt',
  'Lübeck',
  'Oberhausen',
  'Rostock',
  'Kassel',
  'Hagen',
  'Potsdam',
  'Saarbrücken',
  'Hamm',
  'Oldenburg',
  'Ludwigshafen am Rhein',
  'Mülheim an der Ruhr',
  'Leverkusen',
  'Darmstadt',
  'Osnabrück',
  'Solingen',
  'Herne',
  'Heidelberg',
  'Paderborn',
  'Neuss',
  'Regensburg',
  'Ingolstadt',
  'Pforzheim',
  'Würzburg',
  'Offenbach am Main',
  'Heilbronn',
  'Fürth',
  'Göttingen',
  'Ulm',
  'Wolfsburg',
  'Reutlingen',
  'Bremerhaven',
  'Bottrop',
  'Erlangen',
  'Recklinghausen',
  'Remscheid',
  'Koblenz',
  'Bergisch Gladbach',
  'Jena',
  'Trier',
  'Salzgitter',
  'Siegen',
  'Moers',
  'Kaiserslautern',
] as const;

/**
 * Nationwide sentinel, then the 16 Bundesländer, the 19 Regierungsbezirke and
 * every Großstadt — broadest regions first so the datalist surfaces them on top.
 * De-duplicated because the three Stadtstaaten (Berlin, Hamburg, Bremen) are both
 * a Bundesland and a Großstadt; the first (Bundesland) occurrence wins.
 */
export const REGION_SUGGESTIONS: readonly string[] = dedupe([
  NATIONWIDE_REGION,
  ...BUNDESLAENDER,
  ...REGIERUNGSBEZIRKE,
  ...GROSSSTAEDTE,
]);

/** Canonical join separator for multi-value fields. */
const SEPARATOR = '; ';

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  return [...parts, current];
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

/**
 * Parses a stored value into its list items. The directory is inconsistent —
 * most rows separate with `;`, a few with `,`, and several wrap a comma list in
 * parentheses ("Zivilrecht (Mietrecht, Kaufrecht)") — so prefer the semicolon
 * and only ever split at bracket depth zero.
 */
export function parseMultiValue(value: string | null): string[] {
  if (!value?.trim()) return [];
  const separator = value.includes(';') ? ';' : ',';
  const items = splitTopLevel(value, separator)
    .map((item) => item.trim())
    .filter(Boolean);
  return dedupe(items);
}

/** Joins list items back into the canonical `"; "`-separated storage string. */
export function serializeMultiValue(items: string[]): string {
  return dedupe(items.map((item) => item.trim()).filter(Boolean)).join(SEPARATOR);
}
