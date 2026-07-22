import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { de } from '@/lib/i18n/locales/de';

import { ChatUnavailable } from './ChatUnavailable';

describe('ChatUnavailable', () => {
  it('shows the unavailable title and the try-again body', () => {
    render(<ChatUnavailable dict={de} />);
    expect(screen.getByText(de.chatUnavailableTitle)).toBeInTheDocument();
    expect(screen.getByText(de.chatDisabled)).toBeInTheDocument();
  });
});
