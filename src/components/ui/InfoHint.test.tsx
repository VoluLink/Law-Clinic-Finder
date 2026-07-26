import { render, screen } from '@testing-library/react';
import { act, type ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { InfoHint } from './InfoHint';

const HELP = 'Die Stadt oder Region, in der die Clinic tätig ist.';

function renderWithoutBrowserDom(element: ReactElement): string {
  vi.stubGlobal('document', undefined);
  try {
    return renderToString(element);
  } finally {
    vi.unstubAllGlobals();
  }
}

describe('InfoHint', () => {
  it('exposes the explainer as the tooltip text', () => {
    render(<InfoHint text={HELP} label="Region" />);
    expect(screen.getByRole('tooltip')).toHaveTextContent(HELP);
  });

  it('names the trigger after the field it explains', () => {
    render(<InfoHint text={HELP} label="Region" />);
    expect(screen.getByRole('button', { name: 'Erklärung zu Region' })).toBeInTheDocument();
  });

  it('describes the trigger with the explainer for assistive tech', () => {
    render(<InfoHint text={HELP} label="Region" />);
    expect(screen.getByRole('button')).toHaveAccessibleDescription(HELP);
  });

  it('renders the tooltip in the document layer so scrolling parents cannot clip it', () => {
    render(
      <div className="overflow-x-auto">
        <InfoHint text={HELP} label="Region" />
      </div>,
    );
    expect(screen.getByRole('tooltip').parentElement).toBe(document.body);
  });

  it('hydrates its server markup without a recoverable mismatch', async () => {
    const hint = <InfoHint text={HELP} label="Region" />;
    const container = document.createElement('div');
    container.innerHTML = renderWithoutBrowserDom(hint);
    document.body.append(container);
    const recoverableErrors: unknown[] = [];
    const root = hydrateRoot(container, hint, {
      onRecoverableError: (error) => recoverableErrors.push(error),
    });
    await act(async () => undefined);
    await act(async () => root.unmount());
    container.remove();
    expect(recoverableErrors).toEqual([]);
  });
});
