import { describe, expect, it, vi } from 'vitest';

import { createLogger, type LogLine } from '@/lib/logger';

import { recordClinicClick, type ClinicClick } from './click-event';

const CLINIC_ID = '11111111-1111-1111-1111-111111111111';
const click: ClinicClick = { clinicId: CLINIC_ID, kind: 'click_website' };

function createDeps({
  clinic,
  insertError = null,
}: {
  clinic: { id: string } | null;
  insertError?: { message: string } | null;
}) {
  const recordClick = insertError
    ? vi.fn().mockRejectedValue(new Error(insertError.message))
    : vi.fn().mockResolvedValue(Boolean(clinic));
  const lines: LogLine[] = [];
  return {
    deps: { store: { recordClick }, logger: createLogger({}, (l) => lines.push(l)) },
    recordClick,
    lines,
  };
}

describe(recordClinicClick, () => {
  it('records a click for a published clinic', async () => {
    const { deps, recordClick } = createDeps({ clinic: { id: CLINIC_ID } });
    await recordClinicClick(deps, click);
    expect(recordClick).toHaveBeenCalledWith(click);
  });

  it('ignores an unknown or unpublished clinic without recording anything', async () => {
    const { deps, recordClick } = createDeps({ clinic: null });
    await recordClinicClick(deps, click);
    expect(recordClick).toHaveReturned();
  });

  it('logs a warning instead of throwing when the insert fails', async () => {
    const { deps, lines } = createDeps({
      clinic: { id: CLINIC_ID },
      insertError: { message: 'db down' },
    });
    await recordClinicClick(deps, click);
    expect(lines[0]).toMatchObject({ level: 'warn' });
  });
});
