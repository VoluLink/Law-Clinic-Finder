'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { ColorField } from '@/components/ui/ColorField';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { BRANDING_FONTS, brandingSchema, type Branding } from '@/lib/branding/branding';

type Status = 'idle' | 'saving' | 'saved' | 'error';

export function BrandingForm({ branding }: { branding: Branding }) {
  const router = useRouter();
  const [value, setValue] = useState(branding);
  const [status, setStatus] = useState<Status>('idle');
  const [uploading, setUploading] = useState(false);

  const dirty = JSON.stringify(value) !== JSON.stringify(branding);
  const set = <K extends keyof Branding>(key: K, next: Branding[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  async function uploadLogo(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const response = await fetch('/api/admin/branding/logo', { method: 'POST', body: form }).catch(
      () => null,
    );
    const body = response && response.ok ? await response.json().catch(() => null) : null;
    if (body?.url) set('logo_url', body.url);
    else setStatus('error');
    setUploading(false);
  }

  async function save() {
    const parsed = brandingSchema.safeParse(value);
    if (!parsed.success) {
      setStatus('error');
      return;
    }
    setStatus('saving');
    const response = await fetch('/api/admin/branding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    setStatus(response?.ok ? 'saved' : 'error');
    if (response?.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-xl text-sm text-muted">
        Passe das Erscheinungsbild an. Änderungen gelten nach dem Speichern für alle öffentlichen
        Seiten – Finder, Chat und Portal.
      </p>
      <div className="grid gap-4 min-[860px]:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Panel title="Logo" hint="PNG oder SVG, transparenter Hintergrund empfohlen.">
            <div className="flex flex-col gap-4">
              {value.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo from Supabase Storage
                <img src={value.logo_url} alt="Aktuelles Logo" className="h-12 w-auto" />
              ) : (
                <span className="text-sm text-muted">
                  Kein eigenes Logo — die Wortmarke wird verwendet.
                </span>
              )}
              <FileDropzone
                label="Neues Logo hierher ziehen oder auswählen"
                hint="SVG, PNG · max. 2 MB"
                accept="image/png,image/svg+xml"
                disabled={uploading}
                onFile={uploadLogo}
              />
              <Input
                label="Wortmarke (Fallback ohne Logo)"
                value={value.wordmark}
                onChange={(event) => set('wordmark', event.target.value)}
              />
            </div>
          </Panel>
          <Panel title="Farbkomposition" hint="Primär- und Flächenfarben des gesamten Auftritts.">
            <div className="flex flex-col gap-3">
              <ColorField
                label="Primärfarbe"
                value={value.color_primary}
                onChange={(v) => set('color_primary', v)}
              />
              <ColorField
                label="Hintergrund"
                value={value.color_background}
                onChange={(v) => set('color_background', v)}
              />
              <ColorField
                label="Akzent"
                value={value.color_accent}
                onChange={(v) => set('color_accent', v)}
              />
              <ColorField
                label="Textfarbe"
                value={value.color_foreground}
                onChange={(v) => set('color_foreground', v)}
              />
            </div>
          </Panel>
          <Panel title="Typografie" hint="Schriftart für Überschriften und Fließtext.">
            <Select
              label="Schriftart"
              value={value.font}
              onChange={(event) => set('font', event.target.value as Branding['font'])}
              options={BRANDING_FONTS.map((font) => ({ value: font, label: font }))}
            />
          </Panel>
        </div>
        <Panel title="Live-Vorschau">
          <BrandPreview value={value} />
        </Panel>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={save} disabled={!dirty || status === 'saving'}>
          Speichern &amp; veröffentlichen
        </Button>
        {status === 'saved' && <span className="text-sm text-muted">Veröffentlicht.</span>}
        {status === 'error' && (
          <span className="text-sm text-danger">Fehlgeschlagen. Farben als #rrggbb angeben.</span>
        )}
        {dirty && status !== 'saved' && (
          <span className="text-sm text-muted-soft">Ungespeicherte Änderungen</span>
        )}
      </div>
    </div>
  );
}

function BrandPreview({ value }: { value: Branding }) {
  return (
    <div
      className="rounded-xl border border-border p-4"
      style={{
        background: value.color_background,
        color: value.color_foreground,
        fontFamily: value.font,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-extrabold" style={{ color: value.color_primary }}>
          {value.wordmark || 'law clinics'}
        </span>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: value.color_primary, color: value.color_background }}
        >
          Anmelden
        </span>
      </div>
      <div className="text-lg font-extrabold" style={{ color: value.color_primary }}>
        Finde die Law Clinic, die zu dir passt.
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="h-8 flex-1 rounded-lg" style={{ background: value.color_accent }} />
        <span
          className="rounded-lg px-3 py-2 text-xs font-bold"
          style={{ background: value.color_primary, color: value.color_background }}
        >
          Law Clinic finden
        </span>
      </div>
    </div>
  );
}
