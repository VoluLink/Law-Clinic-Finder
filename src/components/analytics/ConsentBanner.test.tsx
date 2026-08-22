import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const writeConsent = vi.hoisted(() => vi.fn());
const updateAnalyticsConsent = vi.hoisted(() => vi.fn());
const measurementId = vi.hoisted(() => ({ current: 'G-TEST' }));
const storedConsent = vi.hoisted(() => ({ current: null as 'granted' | 'denied' | null }));

vi.mock('@/lib/analytics/consent', () => ({
  get GA_MEASUREMENT_ID() {
    return measurementId.current;
  },
  readConsent: () => storedConsent.current,
  writeConsent,
  updateAnalyticsConsent,
}));

import { ConsentBanner } from './ConsentBanner';

beforeEach(() => {
  measurementId.current = 'G-TEST';
  storedConsent.current = null;
});

describe('ConsentBanner', () => {
  it('shows the choice while no consent exists', () => {
    render(<ConsentBanner />);
    expect(screen.getByRole('dialog', { name: 'Cookie-Einwilligung' })).toBeInTheDocument();
  });

  it('records and applies a granted choice, then hides', async () => {
    render(<ConsentBanner />);
    await userEvent.click(screen.getByRole('button', { name: 'Einverstanden' }));
    expect(writeConsent).toHaveBeenCalledWith('granted');
    expect(updateAnalyticsConsent).toHaveBeenCalledWith('granted');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('records and applies a denied choice, then hides', async () => {
    render(<ConsentBanner />);
    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    expect(writeConsent).toHaveBeenCalledWith('denied');
    expect(updateAnalyticsConsent).toHaveBeenCalledWith('denied');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Without a measurement id the only cookies are the strictly necessary ones,
  // which need no consent — so asking for it would be wrong, not merely noisy.
  // This is why the banner is invisible on an unconfigured deployment.
  it('stays hidden when no measurement id is configured', () => {
    measurementId.current = '';
    render(<ConsentBanner />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays hidden once a choice has already been stored', () => {
    storedConsent.current = 'denied';
    render(<ConsentBanner />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
