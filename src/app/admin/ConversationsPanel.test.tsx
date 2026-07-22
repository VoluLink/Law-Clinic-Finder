import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationsPanel, type ConversationRow } from './ConversationsPanel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const convo: ConversationRow = {
  id: 'c1',
  created_at: '2026-07-16T14:22:00Z',
  redacted_transcript: [
    { role: 'user', content: 'Ärger mit dem Vermieter in Köln' },
    { role: 'assistant', content: 'Ich empfehle die Mietrecht Law Clinic.' },
  ],
  redaction_status: 'ok',
  detected_legal_area: 'Mietrecht',
  detected_city: 'Köln',
  matched_clinic_count: 1,
  message_count: 2,
  model: 'claude-haiku-4-5',
};

afterEach(() => vi.unstubAllGlobals());

describe('ConversationsPanel', () => {
  it('shows an empty state when there are no conversations', () => {
    render(<ConversationsPanel conversations={[]} />);
    expect(screen.getByText('Noch keine Gespräche gespeichert.')).toBeInTheDocument();
  });

  it('lists a conversation with its area and message preview', () => {
    render(<ConversationsPanel conversations={[convo]} />);
    expect(screen.getByText('Mietrecht')).toBeInTheDocument();
    expect(screen.getByText('Ärger mit dem Vermieter in Köln')).toBeInTheDocument();
  });

  it('opens the drawer with the transcript when a row is clicked', async () => {
    render(<ConversationsPanel conversations={[convo]} />);
    await userEvent.click(screen.getByText('Ärger mit dem Vermieter in Köln'));
    expect(screen.getByRole('dialog', { name: 'Gesprächsverlauf' })).toBeInTheDocument();
    expect(screen.getByText('Ich empfehle die Mietrecht Law Clinic.')).toBeInTheDocument();
  });

  it('deletes the conversation after confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ConversationsPanel conversations={[convo]} />);
    await userEvent.click(screen.getByText('Ärger mit dem Vermieter in Köln'));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/conversations/c1', { method: 'DELETE' });
  });
});
