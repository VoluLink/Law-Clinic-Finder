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
  input_tokens: 8_400,
  output_tokens: 1_200,
  recommendations: [
    {
      id: 'clinic-1',
      name: 'Mietrecht Law Clinic',
      region: 'Köln',
      legalAreas: ['Mietrecht', 'Zivilrecht'],
      website: 'https://milcc.de/',
    },
    {
      id: 'clinic-2',
      name: 'Studentische Rechtsberatung Köln',
      region: null,
      legalAreas: [],
      website: null,
    },
  ],
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

  it('prices the conversation from its own accumulated tokens', async () => {
    render(<ConversationsPanel conversations={[convo]} />);
    await userEvent.click(screen.getByText('Ärger mit dem Vermieter in Köln'));

    // Haiku: 8.400 in @ $1/M + 1.200 out @ $5/M = $0.0144.
    expect(screen.getByText('API-Kosten: $ 0,0144')).toBeInTheDocument();
  });

  it('says the cost is unknown rather than zero for an unpriced model', async () => {
    const unpriced = { ...convo, model: 'some-other-model' };
    render(<ConversationsPanel conversations={[unpriced]} />);
    await userEvent.click(screen.getByText('Ärger mit dem Vermieter in Köln'));

    expect(screen.getByText('API-Kosten: unbekannt')).toBeInTheDocument();
  });

  it('shows which clinics were recommended in the conversation', async () => {
    render(<ConversationsPanel conversations={[convo]} />);
    await userEvent.click(screen.getByText('Ärger mit dem Vermieter in Köln'));
    expect(screen.getByText('Empfohlene Law Clinics')).toBeInTheDocument();
    expect(screen.getByText('Mietrecht Law Clinic')).toBeInTheDocument();
    expect(screen.getByText('Studentische Rechtsberatung Köln')).toBeInTheDocument();
  });

  it('places the recommended clinic cards after the transcript', async () => {
    render(<ConversationsPanel conversations={[convo]} />);
    await userEvent.click(screen.getByText('Ärger mit dem Vermieter in Köln'));

    const transcript = screen.getByText('Ich empfehle die Mietrecht Law Clinic.');
    const cards = screen.getByRole('list', { name: 'Empfohlene Law Clinics' });
    expect(transcript.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('renders assistant emphasis in the anonymized transcript', async () => {
    const emphasized = {
      ...convo,
      redacted_transcript: [
        { role: 'user' as const, content: 'Aufenthaltsrecht in München' },
        { role: 'assistant' as const, content: 'Die **Refugee Law Clinic Munich** passt.' },
      ],
    };

    render(<ConversationsPanel conversations={[emphasized]} />);
    await userEvent.click(screen.getByText('Aufenthaltsrecht in München'));

    expect(screen.getByText('Refugee Law Clinic Munich')).toHaveProperty('tagName', 'STRONG');
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
