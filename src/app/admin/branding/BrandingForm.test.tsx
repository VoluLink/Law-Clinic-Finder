import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_BRANDING } from '@/lib/branding/branding';

import { BrandingForm } from './BrandingForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

describe('BrandingForm', () => {
  it('renders the palette editor and disables save until something changes', () => {
    render(<BrandingForm branding={DEFAULT_BRANDING} />);
    expect(screen.getByText('Farbkomposition')).toBeInTheDocument();
    expect(screen.getByLabelText('Primärfarbe Hex')).toHaveValue('#0d4b5b');
    expect(screen.getByRole('button', { name: /veröffentlichen/ })).toBeDisabled();
  });

  it('publishes the edited branding via PUT', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<BrandingForm branding={DEFAULT_BRANDING} />);
    await userEvent.type(screen.getByLabelText('Wortmarke (Fallback ohne Logo)'), 'X');
    await userEvent.click(screen.getByRole('button', { name: /veröffentlichen/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/branding',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
