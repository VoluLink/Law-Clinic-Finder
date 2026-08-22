import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ pathname: '/' }));
const readConsent = vi.hoisted(() => vi.fn(() => 'granted'));
const updateAnalyticsConsent = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) => (
    <span data-testid="analytics-script" data-id={id} data-src={src} />
  ),
}));
vi.mock('@/lib/analytics/consent', () => ({
  GA_MEASUREMENT_ID: 'G-TEST',
  readConsent,
  updateAnalyticsConsent,
}));

import { Analytics } from './Analytics';

describe('Analytics', () => {
  beforeEach(() => {
    navigation.pathname = '/';
    vi.clearAllMocks();
  });

  it('does not initialize analytics on the auth confirmation route', () => {
    navigation.pathname = '/auth/confirm';
    render(<Analytics />);
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument();
    expect(readConsent).not.toHaveBeenCalled();
  });

  it('retains analytics on ordinary pages', () => {
    render(<Analytics />);
    expect(screen.getAllByTestId('analytics-script')).toHaveLength(2);
    expect(updateAnalyticsConsent).toHaveBeenCalledWith('granted');
  });
});
