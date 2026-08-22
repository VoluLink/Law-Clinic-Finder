import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_CHAT_MESSAGE_CHARS } from '@/lib/chat/schema';
import {
  encodeChatEvent,
  type ChatEvent,
  type ClinicRecommendation,
} from '@/lib/chat/stream-protocol';
import { getDictionary } from '@/lib/i18n/dictionary';

import { FinderChat } from './FinderChat';

const de = getDictionary('de');
const en = getDictionary('en');

const card: ClinicRecommendation = {
  id: 'ff000000-0000-0000-0000-000000000001',
  rank: 1,
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Stadtgebiet Köln',
  areas: ['Mietrecht'],
  reason: 'Berät genau zu deinem Thema.',
  website: 'https://milcc.de/',
  email: 'contact@example.org',
};

const finalCard: ClinicRecommendation = {
  ...card,
  id: 'ff000000-0000-0000-0000-000000000002',
  name: 'Final Law Clinic Cologne',
  reason: 'Passt zu den späteren Angaben.',
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
  return Response.json(
    { error: 'limited', scope, resetAt: '2099-08-16T22:00:00.000Z' },
    { status: 429 },
  );
}

function renderChat() {
  return render(<FinderChat dict={de} rtl={false} />);
}

async function submitQuery(text: string) {
  await userEvent.type(screen.getByLabelText(de.searchLabel), text);
  await userEvent.click(screen.getByRole('button', { name: new RegExp(de.searchBtn) }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FinderChat', () => {
  it('starts as a search card with the character cap applied', () => {
    renderChat();
    expect(screen.getByLabelText(de.searchLabel)).toHaveAttribute(
      'maxlength',
      String(MAX_CHAT_MESSAGE_CHARS),
    );
  });

  it('puts the AI disclaimer in the same row as the search button', () => {
    renderChat();
    const disclaimer = screen.getByText(de.aiDisclaimer);
    expect(disclaimer.parentElement).toContainElement(
      screen.getByRole('button', { name: de.searchBtn }),
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

  it('renders assistant Markdown emphasis without showing its markers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(streamResponse('Die **Refugee Law Clinic Munich** passt.')),
    );

    renderChat();
    await submitQuery('Ich brauche Hilfe in München');

    expect(await screen.findByText('Refugee Law Clinic Munich')).toHaveProperty(
      'tagName',
      'STRONG',
    );
  });

  it('shows the chat input dock after the first message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse('Antwort')));
    renderChat();
    await submitQuery('Meine Frage');
    expect(await screen.findByLabelText(de.chatPlaceholder)).toBeInTheDocument();
  });

  it('discloses the AI interaction under the chat input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse('Antwort')));
    renderChat();
    await submitQuery('Meine Frage');
    expect(await screen.findByText(de.aiInteractionNotice)).toBeInTheDocument();
  });

  it('does not disclose the AI interaction before the chat is open', () => {
    renderChat();
    expect(screen.queryByText(de.aiInteractionNotice)).not.toBeInTheDocument();
  });

  it('sizes the chat panel to the viewport once the chat starts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse('Antwort')));
    const { container } = renderChat();
    await submitQuery('Meine Frage');

    await screen.findByText('Antwort');
    expect(container.querySelector('[data-chat-active]')).toHaveClass(
      'flex',
      'flex-col',
      'h-[calc(100dvh-var(--nav-h)-1.5rem)]',
    );
  });

  it('lets the message list fill the panel instead of a fixed-height box', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse('Antwort')));
    renderChat();
    await submitQuery('Meine Frage');

    const scroller = (await screen.findByText('Antwort')).closest('.overflow-y-auto');
    expect(scroller).toHaveClass('min-h-0', 'flex-1');
  });

  it('scrolls the chat panel under the sticky nav when it opens', async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse('Antwort')));
    renderChat();
    await submitQuery('Meine Frage');

    await screen.findByText('Antwort');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('titles the chat panel with the product name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse('Antwort')));
    renderChat();
    expect(screen.queryByText('Law Clinic Finder')).not.toBeInTheDocument();

    await submitQuery('Meine Frage');
    expect(await screen.findByText('Law Clinic Finder')).toBeInTheDocument();
  });

  it('shows the minute limit banner and restores the message into the input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(limitResponse('minute')));
    renderChat();
    await submitQuery('Zu schnell getippt');

    expect(await screen.findByText(de.limitMinuteTitle)).toBeInTheDocument();
    expect(screen.getByLabelText(de.searchLabel)).toHaveValue('Zu schnell getippt');
    expect(screen.getByLabelText(de.searchLabel)).toBeDisabled();
    expect(screen.getByRole('button', { name: de.searchBtn })).toBeDisabled();
  });

  it('replaces the start form with the large daily notice on a third-chat 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(limitResponse('day')));
    renderChat();
    await submitQuery('Drittes Anliegen heute');

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveAttribute('data-daily-limit');
    expect(notice).toHaveTextContent(de.limitDailyTitle);
    expect(screen.queryByLabelText(de.searchLabel)).not.toBeInTheDocument();
  });

  it('shows the daily notice only after two completed conversations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(eventResponse([{ t: 'clinics', v: [card] }]))
      .mockResolvedValueOnce(eventResponse([{ t: 'clinics', v: [finalCard] }]))
      .mockResolvedValueOnce(limitResponse('day'));
    vi.stubGlobal('fetch', fetchMock);
    renderChat();

    await submitQuery('Erstes Anliegen');
    await userEvent.click(await screen.findByRole('button', { name: de.chatCompletedBtnRestart }));
    expect(screen.queryByText(de.limitDailyTitle)).not.toBeInTheDocument();
    await submitQuery('Zweites Anliegen');
    await userEvent.click(await screen.findByRole('button', { name: de.chatCompletedBtnRestart }));
    expect(screen.queryByText(de.limitDailyTitle)).not.toBeInTheDocument();
    await submitQuery('Drittes Anliegen');

    expect(await screen.findByText(de.limitDailyTitle)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('uses English for a rate-limit alert after an unsupported-language request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(limitResponse('minute')));
    renderChat();
    await submitQuery('Necesito ayuda con mi alquiler.');

    expect(await screen.findByText(en.limitMinuteTitle)).toBeInTheDocument();
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

  it('closes the chat after a recommendation and offers a fresh chat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventResponse([{ t: 'clinics', v: [card] }])));
    renderChat();
    await submitQuery('Mietproblem in Köln');

    expect(await screen.findByText(de.chatCompletedTitle)).toBeInTheDocument();
    expect(screen.queryByLabelText(de.chatPlaceholder)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: de.chatCompletedBtnRestart }));
    expect(screen.getByLabelText(de.searchLabel)).toBeInTheDocument();
  });

  it('offers the current recommendations as a PDF or plain text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventResponse([{ t: 'clinics', v: [card] }])));
    renderChat();
    await submitQuery('Mietproblem in Köln');

    expect(await screen.findByRole('button', { name: de.downloadPdf })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: de.copyText })).toBeInTheDocument();
  });

  it('copies the submitted details and clinic contacts when saving text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventResponse([{ t: 'clinics', v: [card] }])));
    renderChat();
    await submitQuery('Mietproblem in Köln');
    await userEvent.click(await screen.findByRole('button', { name: de.copyText }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(card.email!));
    expect(screen.getByRole('button', { name: de.copiedText })).toBeInTheDocument();
  });

  it('starts a fresh export after a completed recommendation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(eventResponse([{ t: 'clinics', v: [card] }]))
      .mockResolvedValueOnce(eventResponse([{ t: 'clinics', v: [finalCard] }]));
    vi.stubGlobal('fetch', fetchMock);
    renderChat();
    await submitQuery('Ich habe eine Kündigung erhalten.');
    await userEvent.click(await screen.findByRole('button', { name: de.chatCompletedBtnRestart }));
    await submitQuery('Ich wohne in Köln.');
    await userEvent.click(await screen.findByRole('button', { name: de.copyText }));

    const copiedText = writeText.mock.calls[0]?.[0] as string;
    expect({
      previousChatExcluded: !copiedText.includes('Ich habe eine Kündigung erhalten.'),
      currentChatIncluded: copiedText.includes('Ich wohne in Köln.'),
      finalClinic: copiedText.includes(finalCard.name),
      replacedClinic: copiedText.includes(card.name),
      chatRequests: fetchMock.mock.calls.length,
    }).toEqual({
      previousChatExcluded: true,
      currentChatIncluded: true,
      finalClinic: true,
      replacedClinic: false,
      chatRequests: 2,
    });
  });

  it('uses English export copy for an unsupported chat language without another request', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const fetchMock = vi.fn().mockResolvedValue(eventResponse([{ t: 'clinics', v: [card] }]));
    vi.stubGlobal('fetch', fetchMock);
    renderChat();
    await submitQuery('Necesito ayuda con mi alquiler.');

    expect(await screen.findByText(en.whyFits)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.downloadPdf })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: en.copyText }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(en.exportTitle));
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it('renders the no-match conclusion and returns to the search card on restart', async () => {
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

    expect(await screen.findByText(de.noMatchResultTitle)).toBeInTheDocument();
    expect(await screen.findByText(de.noMatchTitle)).toBeInTheDocument();
    expect(screen.queryByLabelText(de.chatPlaceholder)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: de.noMatchBtnDirectory })).toHaveAttribute(
      'href',
      'https://law-clinics.de/',
    );
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

  it('explains an overloaded assistant and keeps the partial text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        eventResponse([
          { t: 'text', v: 'Ich schaue nach' },
          { t: 'error', code: 'overloaded' },
        ]),
      ),
    );
    renderChat();
    await submitQuery('Meine Frage');

    expect(await screen.findByRole('alert')).toHaveTextContent(de.chatErrorOverloaded);
    expect(screen.getByText('Ich schaue nach')).toBeInTheDocument();
  });

  it.each([
    ['rate_limited', de.chatErrorRateLimited],
    ['unavailable', de.chatErrorUnavailable],
    ['timeout', de.chatErrorTimeout],
    ['internal', de.chatError],
  ] as const)('renders its own message for %s', async (code, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventResponse([{ t: 'error', code }])));
    renderChat();
    await submitQuery('Meine Frage');

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });

  it('does not mistake an error frame for a no-match result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(eventResponse([{ t: 'error', code: 'internal' }])),
    );
    renderChat();
    await submitQuery('Meine Frage');

    await screen.findByRole('alert');
    expect(screen.queryByText(de.noMatchTitle)).not.toBeInTheDocument();
  });

  it('resends the last question without duplicating it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(eventResponse([{ t: 'error', code: 'overloaded' }]))
      .mockResolvedValueOnce(eventResponse([{ t: 'text', v: 'Jetzt klappt es' }]));
    vi.stubGlobal('fetch', fetchMock);
    renderChat();
    await submitQuery('Meine Frage');

    await userEvent.click(await screen.findByRole('button', { name: de.chatRetry }));

    expect(await screen.findByText('Jetzt klappt es')).toBeInTheDocument();
    expect(screen.getAllByText('Meine Frage')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
