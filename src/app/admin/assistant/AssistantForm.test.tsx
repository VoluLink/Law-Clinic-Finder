import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeChatSettings } from '@/lib/settings.fixtures';

import { AssistantForm } from './AssistantForm';

const defaults = { chat_system_prompt: 'Standard-Rolle', chat_skill: 'Standard-Ablauf' };

describe('AssistantForm', () => {
  it('lists every assistant tool in the toolbox', () => {
    render(<AssistantForm initial={makeChatSettings()} defaults={defaults} />);
    for (const name of [
      'list_directory_terms',
      'search_clinics',
      'recommend_clinics',
      'report_no_match',
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('warns when the assistant has no role or procedure', () => {
    render(
      <AssistantForm
        initial={makeChatSettings({ chat_system_prompt: '', chat_skill: '' })}
        defaults={defaults}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('kann so nicht arbeiten');
  });

  it('shows no warning when role and procedure are present', () => {
    render(<AssistantForm initial={makeChatSettings()} defaults={defaults} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('restores the stored default text when reset is clicked', () => {
    render(
      <AssistantForm
        initial={makeChatSettings({ chat_system_prompt: 'Eigene Rolle' })}
        defaults={defaults}
      />,
    );
    const role = screen.getByLabelText('Rolle');
    expect(role).toHaveValue('Eigene Rolle');
    fireEvent.click(screen.getAllByRole('button', { name: 'Auf Standard zurücksetzen' })[0]);
    expect(role).toHaveValue('Standard-Rolle');
  });
});
