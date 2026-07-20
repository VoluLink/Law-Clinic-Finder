import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FaqAccordion, type FaqItem } from './FaqAccordion';

const items: FaqItem[] = [
  { question: 'Was kostet die Beratung?', answer: 'Nichts.' },
  { question: 'Wer berät mich?', answer: 'Studierende.' },
];

describe('FaqAccordion', () => {
  it('opens the first item by default', () => {
    render(<FaqAccordion items={items} />);
    expect(screen.getByText('Nichts.')).toBeInTheDocument();
    expect(screen.queryByText('Studierende.')).not.toBeInTheDocument();
  });

  it('opening another item closes the current one', async () => {
    render(<FaqAccordion items={items} />);
    await userEvent.click(screen.getByRole('button', { name: /Wer berät mich\?/ }));
    expect(screen.getByText('Studierende.')).toBeInTheDocument();
    expect(screen.queryByText('Nichts.')).not.toBeInTheDocument();
  });

  it('clicking the open item closes it', async () => {
    render(<FaqAccordion items={items} />);
    await userEvent.click(screen.getByRole('button', { name: /Was kostet die Beratung\?/ }));
    expect(screen.queryByText('Nichts.')).not.toBeInTheDocument();
  });
});
