import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LanguageSwitcher } from './LanguageSwitcher';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('LanguageSwitcher', () => {
  it('shows the current language code', () => {
    render(<LanguageSwitcher current="tr" label="Sprache" />);
    expect(screen.getByRole('button', { name: /TR/ })).toBeInTheDocument();
  });

  it('lists all nine languages when opened', async () => {
    render(<LanguageSwitcher current="de" label="Sprache" />);
    await userEvent.click(screen.getByRole('button', { name: /DE/ }));
    expect(screen.getByRole('button', { name: 'Українська' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'العربية' })).toBeInTheDocument();
  });

  it('sets the language cookie and refreshes on selection', async () => {
    render(<LanguageSwitcher current="de" label="Sprache" />);
    await userEvent.click(screen.getByRole('button', { name: /DE/ }));
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(document.cookie).toContain('lcf_lang=en');
    expect(refresh).toHaveBeenCalled();
  });
});
