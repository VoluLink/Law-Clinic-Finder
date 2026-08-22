import type { Lang } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionary';

import { formatExportDate, type RecommendationExport } from './recommendation-export';

const PDF_FILE_NAME = 'law-clinic-finder-recommendation.pdf';
const FINDER_QR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAA0CAMAAADypuvZAAAALVBMVEW7u7v///93d3cAAABEREQzMzPd3d1mZmbMzMyZmZkiIiKIiIju7u5VVVUREREjl1flAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC9UlEQVRIx9VWy3LkMAgEjC1p7Jn//9xtQA+ceDdVua0OsaNSWw3dwBD/YtF/AJJtLu37viX2Flu6jsgA7RrLThxCvvXaVLB2+wtQP7Ev0GBpILIbsNXv9ydAg1oCNftKM5B9q6pK3PQCCQlQHMmgHgNA9qT+vGjf/NVAceQZZARogiMXP4J0FzAMkOVEhT0R/wT5Zzsop/wBdBDW0UGVqPK2W0A4USy3AMWRBCoSK0AN+6aPiyJvLUavnygLlBwxogZj5zIZf3GEXxyrMp1bofGdSDmRMR7rGIbFYb7s3w5CIL7sht1PXvhzHTiyXD7sE1lLxtWRWApHyQQ1LY0F+tgzeL8Vd4saiCx+U888/DKzrZTvxuWsAQK9k+YWm51mumQWoV/soiYbDZ152imJS3I03Ao6cLfJV+EdNS4GeoU4Bvrou3yvJ3vtn52Xb7mINem0pHOQp8rzqxab/2N6Va7nojfKHas6PXsKHZFQVW7FmQvRAz2eUfOy0XD5cNZoLDhXkQskgA/PhyXC60maSyke7u0meAWsC4XRUj1Vuti2IFVxyeiuk0c/aps7SPsWu3R6B3nU1no06slB0KnBXXjVdoCmMc0gTm20e7i/psr/2ve6kqeVwYypnJE9Mht2kSeoaXUbqZU9FJUd3oGl/UR0I2x99Aa60SPnsE1ROCXiC8h93yvWUlYcdM1yR8or37rR0cu7g3AyQKWHlzrI8t4q6Fnua1oQc+pVy+Ve0NAJy8tdCxJxGEg/IZ1X/FbeqZ5uLSxSrTwaUuhV6bth8/gcNHXaafbPu7h5fBrIhpr3YjK3A4TGhMQ0q6v2PD63/lmP2nl0Pv3yx0m45cadyKM0dPvLUHN6CttgvQV9M6b6x/onAmjP43O4m0cr5LBRlP0TPZS7FPW5pC6m3+j1BGd/nm8Kg2nEMkui+BQqt18sKXuz4saI4jWG9ZaIpNPowWGu1wSBroMg3aMjJJcYpd8RWaeb93wizjVaGLx3eGnQb3/v/QHDvRlzUJNKqwAAAABJRU5ErkJggg==';

type PdfOptions = {
  data: RecommendationExport;
  dict: Dictionary;
  lang: Lang;
  rtl: boolean;
};

export async function downloadRecommendationPdf(options: PdfOptions): Promise<void> {
  await document.fonts?.ready;
  const root = createPdfDocument(options);
  document.body.append(root);
  try {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ format: 'a4', unit: 'pt' });
    await pdf.html(root, pdfRenderOptions());
    pdf.save(PDF_FILE_NAME);
  } finally {
    root.remove();
  }
}

function pdfRenderOptions() {
  return {
    autoPaging: 'text' as const,
    html2canvas: { backgroundColor: '#ffffff', logging: false, scale: 2 },
    margin: 0,
    width: 595,
    windowWidth: 595,
  };
}

function createPdfDocument({ data, dict, lang, rtl }: PdfOptions): HTMLElement {
  const root = document.createElement('article');
  root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  root.setAttribute('lang', lang);
  root.style.cssText = documentStyle(rtl);
  root.innerHTML = buildRecommendationPdfMarkup(data, dict, lang);
  return root;
}

function documentStyle(rtl: boolean): string {
  return [
    'position:fixed',
    'top:0',
    'left:-10000px',
    'z-index:0',
    'width:595px',
    'min-height:842px',
    'box-sizing:border-box',
    'background:#ffffff',
    'padding:14px',
    'color:#365d68',
    'font-family:var(--font-hanken-grotesk),Arial,"Noto Sans Arabic",sans-serif',
    'font-size:11px',
    'line-height:1.45',
    `text-align:${rtl ? 'right' : 'left'}`,
  ].join(';');
}

export function buildRecommendationPdfMarkup(
  data: RecommendationExport,
  dict: Dictionary,
  lang: Lang,
): string {
  const createdAt = formatExportDate(data.generatedAt, lang);
  const cards = data.clinics.map((clinic) => clinicMarkup(clinic, dict)).join('');
  const content = `${pdfHeader(dict, createdAt)}${detailsMarkup(data.details, dict)}${cards}${pdfFooter(dict)}`;
  return `<main data-export-page style="box-sizing:border-box;min-height:814px;background:#fbf3e7;color:#365d68;padding:23px">${content}</main>`;
}

function pdfHeader(dict: Dictionary, createdAt: string): string {
  return `<header style="display:flex;align-items:flex-end;justify-content:space-between;border-bottom:1px solid #afc5ca;padding-bottom:9px"><strong style="display:flex;align-items:flex-start;color:#07566a"><span style="font-size:13px;line-height:11px;letter-spacing:-.5px"><span style="display:block">law clinics</span><span style="display:block;margin-left:11px;font-size:10px;line-height:10px">deutschland</span></span><span style="width:4px;height:22px;margin:1px 0 0 4px;background:#07566a"></span></strong><span style="font-size:9px;font-weight:700;color:#7898a0">${escapeHtml(dict.exportGeneratedOn)} ${escapeHtml(createdAt)}</span></header><h1 style="color:#07566a;font-size:24px;line-height:1.1;letter-spacing:-1px;margin:13px 0 10px;font-weight:800">${escapeHtml(dict.exportTitle)}</h1>`;
}

function detailsMarkup(details: string[], dict: Dictionary): string {
  const detail = details[0] ?? '';
  return `<section style="box-sizing:border-box;min-height:70px;background:#f1e5cf;border-radius:13px;padding:12px 15px;margin-bottom:13px"><strong style="display:block;font-size:8px;line-height:10px;letter-spacing:1.15px;text-transform:uppercase;color:#39717d;margin-bottom:6px">${escapeHtml(dict.exportConcern)}</strong><p data-export-detail style="margin:0;font-size:11px;line-height:16px">${escapeHtml(detail)}</p></section>`;
}

function clinicMarkup(clinic: RecommendationExport['clinics'][number], dict: Dictionary): string {
  const location = clinic.region
    ? `<span style="color:#7898a0;font-size:11px">${escapeHtml(clinic.region)}</span>`
    : '';
  return `<section style="background:#ffffff;border:1px solid #cbdde1;border-radius:12px;padding:14px;margin-bottom:8px;page-break-inside:avoid"><div style="display:flex;align-items:flex-start;gap:10px"><span style="display:inline-flex;align-items:center;justify-content:center;flex:0 0 20px;width:20px;height:20px;border-radius:50%;background:#07566a;color:#fff;font-size:10px;font-weight:700">${clinic.rank}</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;gap:7px;flex-wrap:wrap"><strong style="color:#07566a;font-size:16px;line-height:20px">${escapeHtml(clinic.name)}</strong>${location}</div>${areaMarkup(clinic.areas)}<p style="margin:12px 0 0;font-size:11px;line-height:16px"><strong style="color:#07566a">${escapeHtml(dict.whyFits)}</strong> ${escapeHtml(clinic.reason)}</p>${contactMarkup(clinic, dict)}</div></div></section>`;
}

function areaMarkup(areas: string[]): string {
  if (areas.length === 0) return '';
  const tags = areas
    .map(
      (area) =>
        `<span style="display:inline-block;border-radius:4px;background:#edf3f4;color:#07566a;padding:3px 7px;font-size:8px;font-weight:700">${escapeHtml(area)}</span>`,
    )
    .join(' ');
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${tags}</div>`;
}

function contactMarkup(clinic: RecommendationExport['clinics'][number], dict: Dictionary): string {
  if (!clinic.website && !clinic.email) return '';
  const website = clinic.website
    ? `<div><strong>${escapeHtml(dict.exportWebsite)}:</strong> <span style="text-decoration:underline">${escapeHtml(clinic.website)}</span></div>`
    : '';
  const email = clinic.email
    ? `<div><strong>${escapeHtml(dict.exportEmail)}:</strong> <span style="text-decoration:underline">${escapeHtml(clinic.email)}</span></div>`
    : '';
  return `<div style="border-top:1px solid #dce7e9;margin-top:10px;padding-top:8px;font-size:10px;line-height:16px;color:#365d68">${website}${email}</div>`;
}

function pdfFooter(dict: Dictionary): string {
  return `<footer style="display:flex;align-items:center;gap:12px;margin-top:17px;page-break-inside:avoid"><span data-export-qr-frame style="display:inline-flex;background:#ffffff;border-radius:11px;padding:10px"><img data-export-qr src="${FINDER_QR_DATA_URL}" width="48" height="48" alt="" style="image-rendering:pixelated"></span><span><strong style="display:block;color:#07566a;font-size:11px;line-height:14px">${escapeHtml(dict.exportFindMore)}</strong><span style="display:block;margin-top:2px;color:#7898a0;font-size:10px;line-height:12px;text-decoration:underline">law-clinics.de/finder</span></span></footer>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => htmlEntity(character));
}

function htmlEntity(character: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return entities[character] ?? character;
}
