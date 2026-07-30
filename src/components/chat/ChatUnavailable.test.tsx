import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getDictionary } from '@/lib/i18n/dictionary';

import { ChatUnavailable } from './ChatUnavailable';

const de = getDictionary('de');

describe('ChatUnavailable', () => {
  it('shows the unavailable title and the try-again body', () => {
    render(<ChatUnavailable dict={de} />);
    expect(screen.getByText(de.chatUnavailableTitle)).toBeInTheDocument();
    expect(screen.getByText(de.chatDisabled)).toBeInTheDocument();
  });
});
