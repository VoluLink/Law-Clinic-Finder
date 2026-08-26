import type { Lang } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionary';

import type { PdfFontFace, PdfFontFamily } from './pdf-fonts';
import {
  FONT_SIZES,
  PAGE,
  PDF_COLORS,
  planRecommendationPdf,
  type Block,
  type ClinicBlock,
  type ConcernBlock,
  type PdfPlan,
  type TextMeasurer,
} from './pdf-layout';
import { formatExportDate, type RecommendationExport } from './recommendation-export';

const PDF_FILE_NAME = 'law-clinic-finder-recommendation.pdf';
const FINDER_QR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAA0CAMAAADypuvZAAAALVBMVEW7u7v///93d3cAAABEREQzMzPd3d1mZmbMzMyZmZkiIiKIiIju7u5VVVUREREjl1flAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC9UlEQVRIx9VWy3LkMAgEjC1p7Jn//9xtQA+ceDdVua0OsaNSWw3dwBD/YtF/AJJtLu37viX2Flu6jsgA7RrLThxCvvXaVLB2+wtQP7Ev0GBpILIbsNXv9ydAg1oCNftKM5B9q6pK3PQCCQlQHMmgHgNA9qT+vGjf/NVAceQZZARogiMXP4J0FzAMkOVEhT0R/wT5Zzsop/wBdBDW0UGVqPK2W0A4USy3AMWRBCoSK0AN+6aPiyJvLUavnygLlBwxogZj5zIZf3GEXxyrMp1bofGdSDmRMR7rGIbFYb7s3w5CIL7sht1PXvhzHTiyXD7sE1lLxtWRWApHyQQ1LY0F+tgzeL8Vd4saiCx+U888/DKzrZTvxuWsAQK9k+YWm51mumQWoV/soiYbDZ152imJS3I03Ao6cLfJV+EdNS4GeoU4Bvrou3yvJ3vtn52Xb7mINem0pHOQp8rzqxab/2N6Va7nojfKHas6PXsKHZFQVW7FmQvRAz2eUfOy0XD5cNZoLDhXkQskgA/PhyXC60maSyke7u0meAWsC4XRUj1Vuti2IFVxyeiuk0c/aps7SPsWu3R6B3nU1no06slB0KnBXXjVdoCmMc0gTm20e7i/psr/2ve6kqeVwYypnJE9Mht2kSeoaXUbqZU9FJUd3oGl/UR0I2x99Aa60SPnsE1ROCXiC8h93yvWUlYcdM1yR8or37rR0cu7g3AyQKWHlzrI8t4q6Fnua1oQc+pVy+Ve0NAJy8tdCxJxGEg/IZ1X/FbeqZ5uLSxSrTwaUuhV6bth8/gcNHXaafbPu7h5fBrIhpr3YjK3A4TGhMQ0q6v2PD63/lmP2nl0Pv3yx0m45cadyKM0dPvLUHN6CttgvQV9M6b6x/onAmjP43O4m0cr5LBRlP0TPZS7FPW5pC6m3+j1BGd/nm8Kg2nEMkui+BQqt18sKXuz4saI4jWG9ZaIpNPowWGu1wSBroMg3aMjJJcYpd8RWaeb93wizjVaGLx3eGnQb3/v/QHDvRlzUJNKqwAAAABJRU5ErkJggg==';

/**
 * Draws the recommendation sheet with jsPDF's vector API. Text stays real text —
 * selectable, searchable, correct umlauts, a small file — and the page geometry
 * comes from `pdf-layout`, so what is measured is exactly what is drawn.
 */
type PdfOptions = {
  data: RecommendationExport;
  dict: Dictionary;
  lang: Lang;
  rtl: boolean;
};

type JsPdfApi = {
  addFileToVFS: (file: string, base64: string) => void;
  addFont: (file: string, family: string, style: string) => void;
  setFont: (family: string, style?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setDrawColor: (color: string) => void;
  setLineWidth: (width: number) => void;
  text: (text: string, x: number, y: number, options?: { align?: string }) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  roundedRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    rx: number,
    ry: number,
    style?: string,
  ) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  circle: (x: number, y: number, r: number, style?: string) => void;
  addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void;
  addPage: () => void;
  splitTextToSize: (text: string, width: number) => string[];
  getTextWidth: (text: string) => number;
  save: (name: string) => void;
};

/** The sheet carries its own family so `selectFont` stays the single place that
 *  names a font, and no draw function needs to know about languages. */
type Doc = JsPdfApi & { family: PdfFontFamily };

const LATIN_FAMILY: PdfFontFamily = 'Hanken Grotesk';
const CYRILLIC_FAMILY: PdfFontFamily = 'Noto Sans';
const CYRILLIC_LANGS: ReadonlySet<Lang> = new Set(['ru', 'uk']);
const ARABIC_SCRIPT_LANGS: ReadonlySet<Lang> = new Set(['ar', 'fa']);
const CARD_RADIUS = 12;
const CARD_PADDING = 16;
const RANK_RADIUS = 10;

/** `ar` and `fa` never reach this — see `supportsPdfExport`. */
export function pdfFontFamily(lang: Lang): PdfFontFamily {
  return CYRILLIC_LANGS.has(lang) ? CYRILLIC_FAMILY : LATIN_FAMILY;
}

/** jsPDF does no Arabic shaping and no bidi reordering, so an Arabic or Farsi
 *  sheet would come out as unjoined letters in logical order — worse than no
 *  PDF at all. Those languages keep the text export instead. */
export function supportsPdfExport(lang: Lang): boolean {
  return !ARABIC_SCRIPT_LANGS.has(lang);
}

/** Takes only what it needs, so registration is testable without standing up
 *  the whole drawing surface. */
type FontRegistrar = Pick<Doc, 'family' | 'addFileToVFS' | 'addFont'>;

export function registerFontFaces(doc: FontRegistrar, faces: readonly PdfFontFace[]): void {
  for (const face of faces) {
    if (face.family !== doc.family) continue;
    doc.addFileToVFS(face.file, face.data);
    doc.addFont(face.file, face.family, face.style);
  }
}

function selectFont(doc: Doc, size: number, bold: boolean, color: string): void {
  doc.setFont(doc.family, bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(color);
}

/** jsPDF measures against whatever font is currently selected, so the measurer
 *  sets it before asking — otherwise wrapping is computed for the wrong metrics. */
function measurer(doc: Doc): TextMeasurer {
  return {
    widthOf: (text, size, bold) => {
      selectFont(doc, size, bold, PDF_COLORS.text);
      return doc.getTextWidth(text);
    },
    wrap: (text, width, size, bold) => {
      selectFont(doc, size, bold, PDF_COLORS.text);
      return doc.splitTextToSize(text, Math.max(width, 1));
    },
  };
}

function drawPageBackground(doc: Doc): void {
  doc.setFillColor(PDF_COLORS.page);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
}

function drawWordmark(doc: Doc, x: number, y: number): void {
  selectFont(doc, 12, true, PDF_COLORS.primary);
  doc.text('law clinics', x, y);
  selectFont(doc, 9, true, PDF_COLORS.primary);
  doc.text('deutschland', x + 10, y + 10);
  doc.setFillColor(PDF_COLORS.primary);
  doc.rect(x + 62, y - 9, 3.5, 20, 'F');
}

function drawHeader(doc: Doc, plan: PdfPlan, dict: Dictionary): void {
  const top = PAGE.margin + 14;
  drawWordmark(doc, PAGE.margin, top);
  selectFont(doc, FONT_SIZES.small, true, PDF_COLORS.muted);
  doc.text(`${dict.exportGeneratedOn} ${plan.createdAt}`, PAGE.width - PAGE.margin, top, {
    align: 'right',
  });
  doc.setDrawColor(PDF_COLORS.rule);
  doc.setLineWidth(0.6);
  doc.line(PAGE.margin, top + 20, PAGE.width - PAGE.margin, top + 20);
  selectFont(doc, FONT_SIZES.title, true, PDF_COLORS.primary);
  doc.text(plan.title, PAGE.margin, top + 50);
}

function drawConcern(doc: Doc, block: ConcernBlock, y: number): void {
  const width = PAGE.width - PAGE.margin * 2;
  doc.setFillColor(PDF_COLORS.concern);
  doc.roundedRect(PAGE.margin, y, width, block.height, CARD_RADIUS, CARD_RADIUS, 'F');
  selectFont(doc, FONT_SIZES.label, true, PDF_COLORS.muted);
  doc.text(block.label.toUpperCase(), PAGE.margin + CARD_PADDING, y + CARD_PADDING + 6);
  selectFont(doc, FONT_SIZES.body, false, PDF_COLORS.text);
  block.lines.forEach((line, index) => {
    doc.text(
      line,
      PAGE.margin + CARD_PADDING,
      y + CARD_PADDING + 22 + index * FONT_SIZES.body * 1.45,
    );
  });
}

function drawChips(doc: Doc, block: ClinicBlock, left: number, top: number): number {
  let y = top;
  for (const row of block.chipRows) {
    for (const chip of row) {
      doc.setFillColor(PDF_COLORS.chip);
      doc.roundedRect(left + chip.x, y, chip.width, 15, 4, 4, 'F');
      selectFont(doc, FONT_SIZES.chip, true, PDF_COLORS.primary);
      doc.text(chip.text, left + chip.x + 7, y + 10);
    }
    y += 20;
  }
  return y;
}

function drawContact(doc: Doc, block: ClinicBlock, left: number, right: number, top: number): void {
  if (block.contact.length === 0) return;
  doc.setDrawColor(PDF_COLORS.cardBorder);
  doc.setLineWidth(0.5);
  doc.line(left, top, right, top);
  block.contact.forEach((row, index) => {
    const y = top + 14 + index * FONT_SIZES.small * 1.45;
    selectFont(doc, FONT_SIZES.small, true, PDF_COLORS.primary);
    const label = `${row.label}: `;
    doc.text(label, left, y);
    selectFont(doc, FONT_SIZES.small, false, PDF_COLORS.text);
    doc.text(row.value, left + doc.getTextWidth(label), y);
  });
}

function drawClinic(doc: Doc, block: ClinicBlock, y: number): void {
  const width = PAGE.width - PAGE.margin * 2;
  doc.setFillColor(PDF_COLORS.card);
  doc.setDrawColor(PDF_COLORS.cardBorder);
  doc.setLineWidth(0.6);
  doc.roundedRect(PAGE.margin, y, width, block.height, CARD_RADIUS, CARD_RADIUS, 'FD');

  const left = PAGE.margin + CARD_PADDING;
  const textLeft = left + RANK_RADIUS * 2 + 10;
  const right = PAGE.width - PAGE.margin - CARD_PADDING;
  const titleBaseline = y + CARD_PADDING + 13;

  doc.setFillColor(PDF_COLORS.primary);
  doc.circle(left + RANK_RADIUS, titleBaseline - 4, RANK_RADIUS, 'F');
  selectFont(doc, FONT_SIZES.small, true, '#ffffff');
  doc.text(block.rank, left + RANK_RADIUS, titleBaseline - 1, { align: 'center' });

  selectFont(doc, FONT_SIZES.clinicName, true, PDF_COLORS.primary);
  doc.text(block.name, textLeft, titleBaseline);
  if (block.region) {
    const offset = doc.getTextWidth(block.name) + 8;
    selectFont(doc, FONT_SIZES.small, false, PDF_COLORS.muted);
    doc.text(block.region, textLeft + offset, titleBaseline);
  }

  let cursor = titleBaseline + 10;
  if (block.chipRows.length > 0) cursor = drawChips(doc, block, textLeft, cursor);

  selectFont(doc, FONT_SIZES.body, true, PDF_COLORS.primary);
  doc.text(block.reasonLabel, textLeft, cursor + 10);
  const indent = doc.getTextWidth(block.reasonLabel);
  selectFont(doc, FONT_SIZES.body, false, PDF_COLORS.text);
  block.reasonLines.forEach((line, index) => {
    const x = index === 0 ? textLeft + indent : textLeft;
    doc.text(line, x, cursor + 10 + index * FONT_SIZES.body * 1.45);
  });
  const reasonBottom = cursor + 10 + block.reasonLines.length * FONT_SIZES.body * 1.45;
  drawContact(doc, block, textLeft, right, reasonBottom);
}

function drawFooter(doc: Doc, plan: PdfPlan): void {
  const y = PAGE.height - PAGE.margin - 58;
  doc.setFillColor(PDF_COLORS.card);
  doc.roundedRect(PAGE.margin, y, 58, 58, 10, 10, 'F');
  doc.addImage(FINDER_QR_DATA_URL, 'PNG', PAGE.margin + 9, y + 9, 40, 40);
  selectFont(doc, FONT_SIZES.body, true, PDF_COLORS.primary);
  doc.text(plan.footer.title, PAGE.margin + 72, y + 26);
  selectFont(doc, FONT_SIZES.small, false, PDF_COLORS.muted);
  doc.text(plan.footer.url, PAGE.margin + 72, y + 40);
}

function drawBlock(doc: Doc, block: Block, y: number): void {
  if (block.kind === 'concern') return drawConcern(doc, block, y);
  return drawClinic(doc, block, y);
}

export function renderPlan(doc: Doc, plan: PdfPlan, dict: Dictionary): void {
  plan.pages.forEach((page, index) => {
    if (index > 0) doc.addPage();
    drawPageBackground(doc);
    if (index === 0) drawHeader(doc, plan, dict);
    for (const placed of page.blocks) drawBlock(doc, placed.block, placed.y);
    if (index === plan.pages.length - 1) drawFooter(doc, plan);
  });
}

export async function downloadRecommendationPdf(options: PdfOptions): Promise<void> {
  const [{ jsPDF }, { PDF_FONT_FACES }] = await Promise.all([
    import('jspdf'),
    import('./pdf-fonts'),
  ]);
  const doc: Doc = Object.assign(new jsPDF({ format: 'a4', unit: 'pt' }) as unknown as JsPdfApi, {
    family: pdfFontFamily(options.lang),
  });
  registerFontFaces(doc, PDF_FONT_FACES);
  const plan = planRecommendationPdf(
    options.data,
    options.dict,
    measurer(doc),
    formatExportDate(options.data.generatedAt, options.lang),
  );
  renderPlan(doc, plan, options.dict);
  doc.save(PDF_FILE_NAME);
}
