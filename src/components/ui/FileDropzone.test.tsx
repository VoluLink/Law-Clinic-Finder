import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FileDropzone } from './FileDropzone';

describe('FileDropzone', () => {
  it('renders the label and hint', () => {
    render(<FileDropzone label="Logo hochladen" hint="PNG oder SVG" onFile={vi.fn()} />);
    expect(screen.getByText('Logo hochladen')).toBeInTheDocument();
    expect(screen.getByText('PNG oder SVG')).toBeInTheDocument();
  });

  it('calls onFile with the chosen file', () => {
    const onFile = vi.fn();
    const { container } = render(<FileDropzone label="Logo" onFile={onFile} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });
});
