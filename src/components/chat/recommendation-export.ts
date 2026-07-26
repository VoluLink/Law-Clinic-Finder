import type { ClinicRecommendation } from '@/lib/chat/stream-protocol';
import type { Lang } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionary';

export type ChatExportMessage = {
  role: 'user' | 'assistant';
  content: string;
  recommendations?: ClinicRecommendation[];
};

export type RecommendationExport = {
  details: string[];
  clinics: ClinicRecommendation[];
  generatedAt: string;
};

export function collectRecommendationExport(
  messages: ChatExportMessage[],
  generatedAt = new Date().toISOString(),
): RecommendationExport {
  const details = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.trim())
    .filter(Boolean);
  const clinics = latestRecommendations(messages).map((clinic, index) => ({
    ...clinic,
    rank: index + 1,
  }));
  return { details, clinics, generatedAt };
}

function latestRecommendations(messages: ChatExportMessage[]): ClinicRecommendation[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const recommendations = messages[index]?.recommendations;
    if (recommendations) return recommendations;
  }
  return [];
}

export function buildRecommendationText(
  data: RecommendationExport,
  dict: Dictionary,
  lang: Lang,
): string {
  const details = data.clinics.flatMap((clinic) => clinicText(clinic, dict));
  const suppliedDetails = data.details.map((detail) => `- ${detail.replaceAll('\n', '\n  ')}`);
  const createdAt = formatExportDate(data.generatedAt, lang);
  return [
    dict.exportTitle,
    `${dict.exportGeneratedOn} ${createdAt}`,
    '',
    `${dict.exportConcern}:`,
    ...suppliedDetails,
    '',
    ...details,
  ].join('\n');
}

export function formatExportDate(generatedAt: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(generatedAt));
}

function clinicText(clinic: ClinicRecommendation, dict: Dictionary): string[] {
  const lines = [`${clinic.rank}. ${clinic.name}`];
  if (clinic.region) lines.push(clinic.region);
  if (clinic.areas.length > 0) lines.push(`${dict.exportAreas}: ${clinic.areas.join(', ')}`);
  lines.push(`${dict.whyFits} ${clinic.reason}`);
  if (clinic.website) lines.push(`${dict.exportWebsite}: ${clinic.website}`);
  if (clinic.email) lines.push(`${dict.exportEmail}: ${clinic.email}`);
  return [...lines, ''];
}

export async function copyRecommendationText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  copyWithTextArea(text);
}

function copyWithTextArea(text: string): void {
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('copy failed');
}
