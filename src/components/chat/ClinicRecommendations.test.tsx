import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ClinicRecommendation } from '@/lib/chat/stream-protocol';
import { getDictionary } from '@/lib/i18n/dictionary';

import { ClinicRecommendations } from './ClinicRecommendations';

const de = getDictionary('de');

const withEmail: ClinicRecommendation = {
  id: 'ff000000-0000-0000-0000-000000000001',
  rank: 1,
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Stadtgebiet Köln',
  areas: ['Mietrecht', 'Nebenkosten'],
  reason: 'Berät genau zu deinem Thema.',
  website: 'https://milcc.de/',
  email: 'contact@example.org',
};

const withoutEmail: ClinicRecommendation = {
  ...withEmail,
  rank: 2,
  name: 'Studentische Rechtsberatung Köln',
  region: null,
  areas: [],
  email: null,
  website: 'https://srk.uni-koeln.de/',
};

function renderCards(items: ClinicRecommendation[]) {
  return render(<ClinicRecommendations dict={de} items={items} />);
}

describe('ClinicRecommendations', () => {
  it('renders nothing when there is nothing to recommend', () => {
    const { container } = renderCards([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('names each recommended clinic', () => {
    renderCards([withEmail, withoutEmail]);
    expect(screen.getByText(withEmail.name)).toBeInTheDocument();
    expect(screen.getByText(withoutEmail.name)).toBeInTheDocument();
  });

  it('shows the rank so the ordering is visible, not just implied', () => {
    renderCards([withEmail, withoutEmail]);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it("shows the model's reason under the localized lead-in", () => {
    renderCards([withEmail]);
    expect(screen.getByText(de.whyFits)).toBeInTheDocument();
    expect(screen.getByText(withEmail.reason)).toBeInTheDocument();
  });

  it('renders each legal area as its own tag', () => {
    renderCards([withEmail]);
    expect(screen.getByText('Mietrecht')).toBeInTheDocument();
    expect(screen.getByText('Nebenkosten')).toBeInTheDocument();
  });

  it('opens the website in a new tab without leaking the referrer window', () => {
    renderCards([withEmail]);
    const link = screen.getByRole('link', { name: new RegExp(de.toWebsite) });
    expect(link).toHaveAttribute('href', withEmail.website);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('offers a mailto action when the clinic has a contact address', () => {
    renderCards([withEmail]);
    expect(screen.getByRole('link', { name: withEmail.email! })).toHaveAttribute(
      'href',
      `mailto:${withEmail.email}`,
    );
  });

  it('omits the mail action entirely when no address is on file', () => {
    renderCards([withoutEmail]);
    const card = screen.getByText(withoutEmail.name).closest('li');
    expect(within(card!).queryByRole('link', { name: /@/ })).not.toBeInTheDocument();
  });

  it('skips the website action when the clinic has no homepage', () => {
    renderCards([{ ...withoutEmail, website: null }]);
    expect(screen.queryByRole('link', { name: new RegExp(de.toWebsite) })).not.toBeInTheDocument();
  });

  it('closes with the localized contact note', () => {
    renderCards([withEmail]);
    expect(screen.getByText(de.recFooter)).toBeInTheDocument();
  });
});

describe('ClinicRecommendations rendering sinks', () => {
  it('renders HTML in the model reason as visible text, never as markup', () => {
    const reason = '<img src=x onerror=alert(1)>';
    const { container } = renderCards([{ ...withEmail, reason }]);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(reason, { exact: false })).toBeInTheDocument();
  });

  it('renders no website button when the decoder dropped an unusable link', () => {
    renderCards([{ ...withEmail, website: null, email: null }]);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('opens the clinic homepage in a tab that cannot reach back into this one', () => {
    renderCards([{ ...withEmail, email: null }]);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
