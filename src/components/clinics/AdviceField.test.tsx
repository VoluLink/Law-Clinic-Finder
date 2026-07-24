import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AdviceField } from './AdviceField';

const ALTERNATIVE_LABEL = 'Welche Leistung bietest du stattdessen an?';

describe('AdviceField', () => {
  it('emits the new advises value when the toggle is flipped', async () => {
    const onAdvisesChange = vi.fn();
    render(
      <AdviceField
        advises={true}
        description=""
        onAdvisesChange={onAdvisesChange}
        onDescriptionChange={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onAdvisesChange).toHaveBeenCalledWith(false);
  });

  it('prompts for the alternative service when the clinic does not advise', () => {
    render(
      <AdviceField
        advises={false}
        description=""
        onAdvisesChange={vi.fn()}
        onDescriptionChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(ALTERNATIVE_LABEL)).toBeInTheDocument();
  });

  it('reports the typed alternative text', async () => {
    const onDescriptionChange = vi.fn();
    render(
      <AdviceField
        advises={false}
        description=""
        onAdvisesChange={vi.fn()}
        onDescriptionChange={onDescriptionChange}
      />,
    );
    await userEvent.type(screen.getByLabelText(ALTERNATIVE_LABEL), 'X');
    expect(onDescriptionChange).toHaveBeenCalledWith('X');
  });

  it('shows the validation error', () => {
    render(
      <AdviceField
        advises={false}
        description=""
        error="Pflichtfeld."
        onAdvisesChange={vi.fn()}
        onDescriptionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Pflichtfeld.')).toBeInTheDocument();
  });
});
