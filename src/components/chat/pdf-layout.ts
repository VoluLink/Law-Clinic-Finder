import type { Dictionary } from '@/lib/i18n/dictionary';

import type { RecommendationExport } from './recommendation-export';

/**
 * Pure page layout for the recommendation PDF, measured but not drawn.
 *
 * The export used to rasterise a DOM tree through html2canvas, which made every
 * glyph a bitmap, approximated flex and gap, and treated `page-break-inside` as a
 * hint — so the printed page drifted from the design and cards could split. Here
 * the geometry is computed first and drawn second, which makes pagination exact
 * and the layout unit-testable without producing a binary.
 *
 * Colours mirror the tokens in `src/app/globals.css`; a PDF cannot read CSS
 * custom properties, so they are repeated here deliberately.
 */
export const PDF_COLORS = {
  page: '#faf2e7',
  card: '#ffffff',
  cardBorder: '#cbdde1',
  concern: '#f1e5cf',
  primary: '#0d4b5b',
  text: '#365d68',
  muted: '#7898a0',
  chip: '#edf3f4',
  rule: '#afc5ca',
} as const;

/** A4 in points, the unit jsPDF uses for this document. */
export const PAGE = { width: 595.28, height: 841.89, margin: 28 } as const;
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const CARD_PADDING = 16;
const CARD_GAP = 10;
const CHIP_HEIGHT = 15;
const CHIP_GAP = 5;
const CHIP_PADDING = 7;
const LINE_GAP = 4;
const RANK_DIAMETER = 20;

export const FONT_SIZES = {
  title: 26,
  clinicName: 15,
  body: 10.5,
  small: 9,
  chip: 8,
  label: 8,
} as const;

/** Injected so layout can be measured without a real jsPDF instance. */
export type TextMeasurer = {
  widthOf: (text: string, size: number, bold: boolean) => number;
  wrap: (text: string, width: number, size: number, bold: boolean) => string[];
};

export type ChipRow = { text: string; x: number; width: number }[];

export type ClinicBlock = {
  kind: 'clinic';
  height: number;
  rank: string;
  name: string;
  region: string | null;
  chipRows: ChipRow[];
  reasonLabel: string;
  reasonLines: string[];
  contact: { label: string; value: string }[];
};

export type ConcernBlock = { kind: 'concern'; height: number; label: string; lines: string[] };
export type Block = ClinicBlock | ConcernBlock;
export type PdfPage = { blocks: { block: Block; y: number }[] };

export type PdfPlan = {
  createdAt: string;
  title: string;
  pages: PdfPage[];
  footer: { title: string; url: string };
};

function lineHeight(size: number): number {
  return size * 1.45;
}

function textBlockHeight(lineCount: number, size: number): number {
  return lineCount * lineHeight(size);
}

function chipRows(labels: string[], measure: TextMeasurer, width: number): ChipRow[] {
  const rows: ChipRow[] = [];
  let row: ChipRow = [];
  let x = 0;
  for (const text of labels) {
    const chipWidth = measure.widthOf(text, FONT_SIZES.chip, true) + CHIP_PADDING * 2;
    if (x + chipWidth > width && row.length > 0) {
      rows.push(row);
      row = [];
      x = 0;
    }
    row.push({ text, x, width: chipWidth });
    x += chipWidth + CHIP_GAP;
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

function contactLines(
  clinic: RecommendationExport['clinics'][number],
  dict: Dictionary,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (clinic.website) rows.push({ label: dict.exportWebsite, value: clinic.website });
  if (clinic.email) rows.push({ label: dict.exportEmail, value: clinic.email });
  return rows;
}

function clinicBlock(
  clinic: RecommendationExport['clinics'][number],
  dict: Dictionary,
  measure: TextMeasurer,
): ClinicBlock {
  const inner = CONTENT_WIDTH - CARD_PADDING * 2;
  const textWidth = inner - RANK_DIAMETER - CARD_GAP;
  const rows = chipRows(clinic.areas, measure, textWidth);
  const reasonLabel = `${dict.whyFits} `;
  const indent = measure.widthOf(reasonLabel, FONT_SIZES.body, true);
  const reasonLines = measure.wrap(clinic.reason, textWidth - indent, FONT_SIZES.body, false);
  const contact = contactLines(clinic, dict);
  return {
    kind: 'clinic',
    rank: String(clinic.rank),
    name: clinic.name,
    region: clinic.region,
    chipRows: rows,
    reasonLabel,
    reasonLines,
    contact,
    height: clinicHeight(rows.length, reasonLines.length, contact.length),
  };
}

function clinicHeight(chipRowCount: number, reasonLineCount: number, contactCount: number): number {
  const title = lineHeight(FONT_SIZES.clinicName);
  const chips = chipRowCount > 0 ? chipRowCount * (CHIP_HEIGHT + CHIP_GAP) + LINE_GAP : 0;
  const reason = textBlockHeight(reasonLineCount, FONT_SIZES.body) + LINE_GAP;
  const contact = contactCount > 0 ? contactCount * lineHeight(FONT_SIZES.small) + CARD_GAP : 0;
  return CARD_PADDING * 2 + title + chips + reason + contact;
}

function concernBlock(details: string[], dict: Dictionary, measure: TextMeasurer): ConcernBlock {
  const lines = measure.wrap(
    details[0] ?? '',
    CONTENT_WIDTH - CARD_PADDING * 2,
    FONT_SIZES.body,
    false,
  );
  return {
    kind: 'concern',
    label: dict.exportConcern,
    lines,
    height:
      CARD_PADDING * 2 +
      lineHeight(FONT_SIZES.label) +
      textBlockHeight(lines.length, FONT_SIZES.body),
  };
}

const HEADER_HEIGHT = 92;
const FOOTER_HEIGHT = 74;

/**
 * Packs blocks onto pages. A block never straddles a page boundary; one taller
 * than a whole page starts its own page and is allowed to overflow rather than
 * looping forever.
 */
function paginate(blocks: Block[], firstPageTop: number): PdfPage[] {
  const bottom = PAGE.height - PAGE.margin - FOOTER_HEIGHT;
  const pages: PdfPage[] = [{ blocks: [] }];
  let y = firstPageTop;
  for (const block of blocks) {
    const current = pages.at(-1) as PdfPage;
    if (y + block.height > bottom && current.blocks.length > 0) {
      pages.push({ blocks: [] });
      y = PAGE.margin;
    }
    (pages.at(-1) as PdfPage).blocks.push({ block, y });
    y += block.height + CARD_GAP;
  }
  return pages;
}

export function planRecommendationPdf(
  data: RecommendationExport,
  dict: Dictionary,
  measure: TextMeasurer,
  createdAt: string,
): PdfPlan {
  const blocks: Block[] = [
    ...(data.details.length > 0 ? [concernBlock(data.details, dict, measure)] : []),
    ...data.clinics.map((clinic) => clinicBlock(clinic, dict, measure)),
  ];
  return {
    createdAt,
    title: dict.exportTitle,
    pages: paginate(blocks, PAGE.margin + HEADER_HEIGHT),
    footer: { title: dict.exportFindMore, url: 'law-clinics.de/finder' },
  };
}
