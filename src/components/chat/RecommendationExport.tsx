'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { Lang } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionary';

import {
  buildRecommendationText,
  copyRecommendationText,
  type RecommendationExport as RecommendationExportData,
} from './recommendation-export';
import { downloadRecommendationPdf, supportsPdfExport } from './recommendation-pdf';

type Feedback = 'copied' | 'error' | 'preparing' | null;

type RecommendationExportProps = {
  data: RecommendationExportData;
  dict: Dictionary;
  lang: Lang;
  rtl: boolean;
};

export function RecommendationExport({ data, dict, lang, rtl }: RecommendationExportProps) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const text = buildRecommendationText(data, dict, lang);
  const pdfAvailable = supportsPdfExport(lang);

  async function handleDownload(): Promise<void> {
    setFeedback('preparing');
    try {
      await downloadRecommendationPdf({ data, dict, lang, rtl });
      setFeedback(null);
    } catch {
      setFeedback('error');
    }
  }

  async function handleCopy(): Promise<void> {
    try {
      await copyRecommendationText(text);
      setFeedback('copied');
    } catch {
      setFeedback('error');
    }
  }

  return (
    <section className="rounded-2xl bg-primary p-5 text-primary-foreground sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
            <Icon name="download" className="size-5" />
          </span>
          <div>
            <h3 className="text-lg font-extrabold">{dict.saveRecommendations}</h3>
            <p className="mt-1 max-w-[360px] text-sm leading-relaxed text-primary-foreground/75">
              {dict.saveRecommendationsDescription}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-2.5">
            {pdfAvailable && (
              <Button
                variant="accent"
                disabled={feedback === 'preparing'}
                onClick={() => void handleDownload()}
                className="gap-2 px-4 py-3 text-sm font-bold"
              >
                <Icon name="file-lines" className="size-4" />
                {feedback === 'preparing' ? dict.pdfPreparing : dict.downloadPdf}
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={feedback === 'preparing'}
              onClick={() => void handleCopy()}
              className="gap-2 border-primary-foreground/45 bg-transparent px-4 py-3 text-sm font-bold text-primary-foreground hover:border-primary-foreground hover:bg-primary-foreground/10"
            >
              <Icon name="copy" className="size-4" />
              {feedback === 'copied' ? dict.copiedText : dict.copyText}
            </Button>
          </div>
          {!pdfAvailable && (
            <p className="max-w-[320px] text-sm leading-relaxed text-primary-foreground/75">
              {dict.pdfUnavailableScript}
            </p>
          )}
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {feedback === 'copied'
          ? dict.copiedText
          : feedback === 'preparing'
            ? dict.pdfPreparing
            : ''}
      </p>
      {feedback === 'error' && <p className="mt-4 text-sm text-accent">{dict.exportError}</p>}
    </section>
  );
}
