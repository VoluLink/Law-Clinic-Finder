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
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const lookup = {
    select: () => lookup,
    eq: () => lookup,
    maybeSingle: () => Promise.resolve({ data: clinic }),
  };
  const lines: LogLine[] = [];
  const adminClient = {
    from: (table: string) => (table === 'clinic_events' ? { insert } : lookup),
  };
  return {
    deps: { adminClient: adminClient as never, logger: createLogger({}, (l) => lines.push(l)) },
    insert,
    lines,
  };
}

describe(recordClinicClick, () => {
  it('records a click for a published clinic', async () => {
    const { deps, insert } = createDeps({ clinic: { id: CLINIC_ID } });
    await recordClinicClick(deps, click);
    expect(insert).toHaveBeenCalledWith({ clinic_id: CLINIC_ID, kind: 'click_website' });
  });

  it('ignores an unknown or unpublished clinic without recording anything', async () => {
    const { deps, insert } = createDeps({ clinic: null });
    await recordClinicClick(deps, click);
    expect(insert).not.toHaveBeenCalled();
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
