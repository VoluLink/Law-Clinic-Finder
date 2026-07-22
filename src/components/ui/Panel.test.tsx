import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Panel } from './Panel';

describe('Panel', () => {
  it('renders its title and content', () => {
    render(<Panel title="Datenbank">Inhalt</Panel>);
    expect(screen.getByRole('heading', { name: 'Datenbank' })).toBeInTheDocument();
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('renders an action node in the header', () => {
    render(
      <Panel title="Liste" action={<button>Aktion</button>}>
        x
      </Panel>,
    );
    expect(screen.getByRole('button', { name: 'Aktion' })).toBeInTheDocument();
  });
});
