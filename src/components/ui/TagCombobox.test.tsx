import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TagCombobox } from './TagCombobox';

const SUGGESTIONS = ['Mietrecht', 'Asylrecht', 'Arbeitsrecht'];

function setup(value = '', onChange = vi.fn()) {
  render(
    <TagCombobox
      label="Rechtsgebiete"
      value={value}
      onChange={onChange}
      suggestions={SUGGESTIONS}
    />,
  );
  return { onChange, input: screen.getByRole('combobox', { name: 'Rechtsgebiete' }) };
}

describe('TagCombobox', () => {
  it('renders the stored value as removable chips', () => {
    setup('Mietrecht; Asylrecht');
    expect(screen.getByRole('button', { name: 'Mietrecht entfernen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Asylrecht entfernen' })).toBeInTheDocument();
  });

  it('adds a suggestion when it is clicked, emitting a "; "-joined string', async () => {
    const { onChange, input } = setup('Mietrecht');
    await userEvent.click(input);
    await userEvent.click(screen.getByRole('option', { name: 'Asylrecht' }));
    expect(onChange).toHaveBeenCalledWith('Mietrecht; Asylrecht');
  });

  it('adds a custom typed value on Enter when nothing matches', async () => {
    const { onChange, input } = setup('');
    await userEvent.type(input, 'Verkehrsrecht{Enter}');
    expect(onChange).toHaveBeenCalledWith('Verkehrsrecht');
  });

  it('completes a partial query to the top matching suggestion on Enter', async () => {
    const { onChange, input } = setup('');
    await userEvent.type(input, 'Miet{Enter}');
    expect(onChange).toHaveBeenCalledWith('Mietrecht');
  });

  it('removes a chip when its remove button is clicked', async () => {
    const { onChange } = setup('Mietrecht; Asylrecht');
    await userEvent.click(screen.getByRole('button', { name: 'Mietrecht entfernen' }));
    expect(onChange).toHaveBeenCalledWith('Asylrecht');
  });

  it('removes the last chip on Backspace when the query is empty', async () => {
    const { onChange, input } = setup('Mietrecht; Asylrecht');
    await userEvent.click(input);
    await userEvent.keyboard('{Backspace}');
    expect(onChange).toHaveBeenCalledWith('Mietrecht');
  });

  it('filters the suggestion list by the typed query', async () => {
    const { input } = setup('');
    await userEvent.type(input, 'Miet');
    expect(screen.getByRole('option', { name: 'Mietrecht' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Arbeitsrecht' })).not.toBeInTheDocument();
  });

  it('hides suggestions that are already selected', async () => {
    const { input } = setup('Mietrecht');
    await userEvent.click(input);
    expect(screen.queryByRole('option', { name: 'Mietrecht' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Asylrecht' })).toBeInTheDocument();
  });

  it('surfaces the hint and marks the combobox required', () => {
    render(
      <TagCombobox
        label="Region"
        value=""
        onChange={vi.fn()}
        suggestions={SUGGESTIONS}
        hint="Mehrere Städte möglich."
        required
      />,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mehrere Städte möglich.');
    expect(screen.getByRole('combobox', { name: 'Region' })).toHaveAttribute(
      'aria-required',
      'true',
    );
  });
});
