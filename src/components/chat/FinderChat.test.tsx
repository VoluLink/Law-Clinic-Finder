import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_CHAT_MESSAGE_CHARS } from '@/lib/chat/schema';
import {
  encodeChatEvent,
  type ChatEvent,
  type ClinicRecommendation,
} from '@/lib/chat/stream-protocol';
import { de } from '@/lib/i18n/locales/de';

import { FinderChat } from './FinderChat';

const card: ClinicRecommendation = {
  id: 'ff000000-0000-0000-0000-000000000001',
  rank: 1,
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Stadtgebiet Köln',
  areas: ['Mietrecht'],
  reason: 'Berät genau zu deinem Thema.',
  website: 'https://milcc.de/',
  email: 'kontakt@milcc.de',
};

/** Serialises frames the way the route does, optionally split across chunks. */
function eventResponse(events: ChatEvent[], chunkSize = Infinity): Response {
  const wire = events.map(encodeChatEvent).join('');
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (let at = 0; at < wire.length; at += chunkSize) {
        controller.enqueue(encoder.encode(wire.slice(at, at + chunkSize)));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

function streamResponse(text: string): Response {
  return eventResponse([{ t: 'text', v: text }]);
}

function limitResponse(scope: 'minute' | 'day'): Response {
  return Response.json({ error: 'limited', scope }, { status: 429 });
}

function renderChat() {
  render(<FinderChat dict={de} rtl={false} />);
}

async function submitQuery(text: string) {
  await userEvent.type(screen.getByLabelText(de.searchLabel), text);
  await userEvent.click(screen.getByRole('button', { name: new RegExp(de.searchBtn) }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FinderChat', () => {
  it('starts as a search card with the character cap applied', () => {
    renderChat();
    expect(screen.getByLabelText(de.searchLabel)).toHaveAttribute(
      'maxlength',
      String(MAX_CHAT_MESSAGE_CHARS),
    );
  });

  it('seeds the conversation with the query and streams the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamResponse('Hier ist eine Law Clinic.'));
    vi.stubGlobal('fetch', fetchMock);

    renderChat();
    await submitQuery('Ärger mit dem Vermieter in Köln');

    expect(await screen.findByText('Hier ist eine Law Clinic.')).toBeInTheDocument();
    expect(screen.getByText('Ärger mit dem Vermieter in Köln')).toBeInTheDocument();
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages).toEqual([{ role: 'user', content: 'Ärger mit dem Vermieter in Köln' }]);
  });

  it('shows the chat input dock after the first message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse('Antwort')));
    renderChat();
    await submitQuery('Meine Frage');
    expect(await screen.findByLabelText(de.chatPlaceholder)).toBeInTheDocument();
  });

  it('shows the minute limit banner and restores the message into the input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(limitResponse('minute')));
    renderChat();
    await submitQuery('Zu schnell getippt');

    expect(await screen.findByText(de.limitMinuteTitle)).toBeInTheDocument();
    expect(screen.getByLabelText(de.searchLabel)).toHaveValue('Zu schnell getippt');
  });

  it('shows the daily limit banner on a day-scope 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(limitResponse('day')));
    renderChat();
    await submitQuery('Meine zwanzigste Nachricht');
    expect(await screen.findByText(de.limitDailyTitle)).toBeInTheDocument();
  });

  it('appends the translated error message when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    renderChat();
    await submitQuery('Frage');
    expect(await screen.findByText(de.chatError)).toBeInTheDocument();
  });

  it('renders a recommended clinic as a card alongside the reply text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        eventResponse([
          { t: 'text', v: 'Das passt zu dir:' },
          { t: 'clinics', v: [card] },
        ]),
      ),
    );
    renderChat();
    await submitQuery('Mietproblem in Köln');

    expect(await screen.findByText(card.name)).toBeInTheDocument();
    expect(screen.getByText('Das passt zu dir:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: card.email! })).toHaveAttribute(
      'href',
      `mailto:${card.email}`,
    );
  });

  it('reassembles a clinics frame that arrives split across chunks', async () => {
    // One byte at a time: every frame boundary lands mid-chunk.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(eventResponse([{ t: 'clinics', v: [card] }], 1)),
    );
    renderChat();
    await submitQuery('Mietproblem in Köln');
    expect(await screen.findByText(card.name)).toBeInTheDocument();
  });

  it('tells the user the assistant is off instead of showing a generic error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    renderChat();
    await submitQuery('Frage');

    expect(await screen.findByText(de.chatDisabled)).toBeInTheDocument();
    expect(screen.queryByText(de.chatError)).not.toBeInTheDocument();
  });

  it('shows the configured greeting once the conversation starts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse('Antwort')));
    render(<FinderChat dict={de} rtl={false} greeting="Hallo, wie kann ich helfen?" />);
    await submitQuery('Meine Frage');
    expect(await screen.findByText('Hallo, wie kann ich helfen?')).toBeInTheDocument();
  });

  it('keeps the greeting out of the history sent to the model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamResponse('Antwort'));
    vi.stubGlobal('fetch', fetchMock);
    render(<FinderChat dict={de} rtl={false} greeting="Hallo!" />);
    await submitQuery('Meine Frage');

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages).toEqual([{ role: 'user', content: 'Meine Frage' }]);
  });

  it('renders the no-match card and returns to the search card on restart', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          eventResponse([
            { t: 'text', v: 'Leider konnte ich keine passende Law Clinic finden.' },
            { t: 'nomatch' },
          ]),
        ),
    );
    renderChat();
    await submitQuery('Sehr spezielles Anliegen ohne Treffer');

    expect(await screen.findByText(de.noMatchTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(de.noMatchBtnRestart) }));

    expect(screen.queryByText(de.noMatchTitle)).not.toBeInTheDocument();
    expect(screen.getByLabelText(de.searchLabel)).toBeInTheDocument();
  });

  it('shows no cards when the reply is prose only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(streamResponse('In welcher Stadt wohnst du?')),
    );
    renderChat();
    await submitQuery('Ich brauche Hilfe');

    expect(await screen.findByText('In welcher Stadt wohnst du?')).toBeInTheDocument();
    expect(screen.queryByText(de.recFooter)).not.toBeInTheDocument();
  });
});
