import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Icon } from './Icon';

describe('Icon', () => {
  it.each([
    ['robot', '0 0 640 512'],
    ['address-card', '0 0 576 512'],
    ['gauge-high', '0 0 512 512'],
  ] as const)('renders %s with its own viewBox and a glyph path', (name, viewBox) => {
    const { container } = render(<Icon name={name} />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(viewBox);
    expect(container.querySelector('path')?.getAttribute('d')?.startsWith('M')).toBe(true);
  });

  it('marks the glyph decorative so screen readers skip it', () => {
    const { container } = render(<Icon name="palette" />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('forwards a className for sizing', () => {
    const { container } = render(<Icon name="palette" className="h-4 w-4" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('h-4');
  });
});
