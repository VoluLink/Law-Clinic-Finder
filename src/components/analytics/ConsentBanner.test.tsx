import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const writeConsent = vi.hoisted(() => vi.fn());
const updateAnalyticsConsent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/analytics/consent', () => ({
  GA_MEASUREMENT_ID: 'G-TEST',
  readConsent: () => null,
  writeConsent,
  updateAnalyticsConsent,
}));

import { ConsentBanner } from './ConsentBanner';

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
});
