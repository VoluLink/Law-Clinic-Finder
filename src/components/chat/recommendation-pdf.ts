import type { Lang } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionary';

import { formatExportDate, type RecommendationExport } from './recommendation-export';

const PDF_FILE_NAME = 'law-clinic-finder-recommendation.pdf';

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
    html2canvas: { backgroundColor: '#ffffff', scale: 0.82 },
    margin: [28, 30, 42, 30],
    width: 535,
    windowWidth: 535,
  };
}

function createPdfDocument({ data, dict, lang, rtl }: PdfOptions): HTMLElement {
  const root = document.createElement('article');
  root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  root.style.cssText = documentStyle(rtl);
  root.innerHTML = buildRecommendationPdfMarkup(data, dict, lang);
  return root;
}

function documentStyle(rtl: boolean): string {
  return [
    'position:fixed',
    'top:0',
    'left:0',
    'z-index:-1',
    'width:535px',
    'box-sizing:border-box',
    'padding:32px',
    'background:#ffffff',
    'color:#202124',
    'font-family:Arial, "Noto Sans Arabic", sans-serif',
    'font-size:16px',
    'line-height:1.48',
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
  return `${pdfHeader(dict, createdAt)}${detailsMarkup(data.details, dict)}${cards}${pdfFooter(dict)}`;
}

function pdfHeader(dict: Dictionary, createdAt: string): string {
  return `<header style="display:flex;align-items:flex-end;justify-content:space-between;border-bottom:1px solid #292929;padding-bottom:13px;margin-bottom:25px"><strong style="font-size:18px;line-height:1.05">law clinics <span style="display:block;font-size:13px;margin-left:20px">deutschland</span></strong><span style="font-size:12px;font-weight:700;color:#6a6a6a">${escapeHtml(dict.exportGeneratedOn)} ${escapeHtml(createdAt)}</span></header><h1 style="font-size:32px;line-height:1.1;letter-spacing:-1.15px;margin:0 0 19px;font-weight:800">${escapeHtml(dict.exportTitle)}</h1>`;
}

function detailsMarkup(details: string[], dict: Dictionary): string {
  const items = details
    .map((detail) => `<li data-export-detail style="margin:0 0 5px">${escapeHtml(detail)}</li>`)
    .join('');
  return `<section style="background:#f1f1f1;border-radius:16px;padding:17px 21px;margin-bottom:20px"><strong style="display:block;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#535353;margin-bottom:7px">${escapeHtml(dict.exportConcern)}</strong><ul style="margin:0;padding-inline-start:20px;list-style-type:disc;font-size:15px;line-height:1.45">${items}</ul></section>`;
}

function clinicMarkup(clinic: RecommendationExport['clinics'][number], dict: Dictionary): string {
  const location = clinic.region
    ? `<span style="color:#6b6b6b;font-size:15px">${escapeHtml(clinic.region)}</span>`
    : '';
  return `<section style="border:1px solid #d1d1d1;border-radius:17px;padding:18px 21px;margin:0 0 13px;page-break-inside:avoid"><div style="display:flex;align-items:flex-start;gap:14px"><span style="display:inline-flex;align-items:center;justify-content:center;flex:0 0 27px;width:27px;height:27px;border-radius:50%;background:#202124;color:#fff;font-size:14px;font-weight:700">${clinic.rank}</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;gap:9px;flex-wrap:wrap"><strong style="font-size:19px;line-height:1.2">${escapeHtml(clinic.name)}</strong>${location}</div>${areaMarkup(clinic.areas)}<p style="margin:13px 0 0;font-size:15px;line-height:1.48"><strong>${escapeHtml(dict.whyFits)}</strong> ${escapeHtml(clinic.reason)}</p>${contactMarkup(clinic, dict)}</div></div></section>`;
}

function areaMarkup(areas: string[]): string {
  if (areas.length === 0) return '';
  const tags = areas
    .map(
      (area) =>
        `<span style="display:inline-block;border-radius:8px;background:#eeeeee;padding:4px 10px;font-size:12px;font-weight:700">${escapeHtml(area)}</span>`,
    )
    .join(' ');
  return `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px">${tags}</div>`;
}

function contactMarkup(clinic: RecommendationExport['clinics'][number], dict: Dictionary): string {
  if (!clinic.website && !clinic.email) return '';
  const website = clinic.website
    ? `<div><strong>${escapeHtml(dict.exportWebsite)}:</strong> <span style="text-decoration:underline">${escapeHtml(clinic.website)}</span></div>`
    : '';
  const email = clinic.email
    ? `<div><strong>${escapeHtml(dict.exportEmail)}:</strong> <span style="text-decoration:underline">${escapeHtml(clinic.email)}</span></div>`
    : '';
  return `<div style="border-top:1px solid #d8d8d8;margin-top:14px;padding-top:12px;font-size:14px;line-height:1.55">${website}${email}</div>`;
}

function pdfFooter(dict: Dictionary): string {
  return `<footer style="border-top:1px solid #292929;margin-top:29px;padding-top:16px"><strong style="font-size:15px">${escapeHtml(dict.exportFindMore)}</strong><span style="display:block;margin-top:2px;color:#666;font-size:13px;text-decoration:underline">law-clinics.de</span></footer>`;
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
