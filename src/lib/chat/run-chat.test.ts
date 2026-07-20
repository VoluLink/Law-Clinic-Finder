import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_CHAT_SETTINGS } from '@/lib/settings';

import { runChat, type AnthropicLike } from './run-chat';
import { decodeChatEvents, type ChatEvent, type ClinicRecommendation } from './stream-protocol';

type FakeEvent = { type: string; delta?: { type: string; text: string } };
type FakeFinal = { content: unknown[]; stop_reason: string };

function fakeTurn(events: FakeEvent[], final: FakeFinal) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* events;
    },
    finalMessage: async () => final,
  };
}

function textDelta(text: string): FakeEvent {
  return { type: 'content_block_delta', delta: { type: 'text_delta', text } };
}

async function readEvents(stream: ReadableStream<Uint8Array>): Promise<ChatEvent[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let wire = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    wire += decoder.decode(value, { stream: true });
  }
  return decodeChatEvents(wire).events;
}

/** The prose the user sees, reassembled from the text frames. */
async function readText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const events = await readEvents(stream);
  return events.map((event) => (event.t === 'text' ? event.v : '')).join('');
}

const userMessage = { role: 'user' as const, content: 'Mietrecht in Berlin?' };

const card: ClinicRecommendation = {
  rank: 1,
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Köln',
  areas: ['Mietrecht'],
  reason: 'Passt genau.',
  website: 'https://milcc.de/',
  email: null,
};

/** Neither tool is called in most tests; failing loudly beats a silent stub. */
function unusedTools() {
  return {
    executeSearchClinics: vi.fn().mockRejectedValue(new Error('search not expected')),
    executeRecommendClinics: vi.fn().mockRejectedValue(new Error('recommend not expected')),
  };
}

describe(runChat, () => {
  it('streams plain text and resolves the run result', async () => {
    const stream = vi.fn().mockReturnValue(
      fakeTurn([textDelta('Hallo'), textDelta(' Welt')], {
        content: [{ type: 'text', text: 'Hallo Welt' }],
        stop_reason: 'end_turn',
      }),
    );
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
    };

    const run = runChat(deps, DEFAULT_CHAT_SETTINGS, [userMessage]);
    expect(await readText(run.stream)).toBe('Hallo Welt');
    await expect(run.result).resolves.toMatchObject({
      assistantText: 'Hallo Welt',
      toolCallCount: 0,
      recommendations: [],
      model: DEFAULT_CHAT_SETTINGS.chat_model,
    });
  });

  it('executes the search tool and continues the conversation', async () => {
    const toolUse = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'search_clinics',
      input: { city: 'Berlin' },
    };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [toolUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(
        fakeTurn([textDelta('Gefunden!')], {
          content: [{ type: 'text', text: 'Gefunden!' }],
          stop_reason: 'end_turn',
        }),
      );
    const executeSearchClinics = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ count: 2, clinics: [] }));
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
      executeSearchClinics,
    };

    const run = runChat(deps, DEFAULT_CHAT_SETTINGS, [userMessage]);
    expect(await readText(run.stream)).toBe('Gefunden!');
    expect(executeSearchClinics).toHaveBeenCalledWith({ city: 'Berlin' });
    await expect(run.result).resolves.toMatchObject({ toolCallCount: 1, matchedClinicCount: 2 });

    const secondCall = stream.mock.calls[1][0];
    expect(secondCall.messages).toHaveLength(3);
    expect(secondCall.messages[2].content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'tool-1',
    });
  });

  it('reports a tool error to the model instead of crashing', async () => {
    const toolUse = { type: 'tool_use', id: 'tool-1', name: 'search_clinics', input: {} };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [toolUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(
        fakeTurn([textDelta('Leider nichts gefunden.')], {
          content: [{ type: 'text', text: 'Leider nichts gefunden.' }],
          stop_reason: 'end_turn',
        }),
      );
    const executeSearchClinics = vi.fn().mockRejectedValue(new Error('boom'));
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
      executeSearchClinics,
    };

    const run = runChat(deps, DEFAULT_CHAT_SETTINGS, [userMessage]);
    await readEvents(run.stream);
    const secondCall = stream.mock.calls[1][0];
    expect(secondCall.messages[2].content[0]).toMatchObject({ is_error: true });
  });

  it('stops after the tool iteration cap', async () => {
    const toolUse = { type: 'tool_use', id: 'tool-1', name: 'search_clinics', input: {} };
    const stream = vi
      .fn()
      .mockReturnValue(fakeTurn([], { content: [toolUse], stop_reason: 'tool_use' }));
    const executeSearchClinics = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ count: 0, clinics: [] }));
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
      executeSearchClinics,
    };

    const run = runChat(deps, DEFAULT_CHAT_SETTINGS, [userMessage]);
    await readEvents(run.stream);
    await run.result;
    expect(stream.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('streams the chosen clinics as a structured frame the UI can render', async () => {
    const toolUse = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'recommend_clinics',
      input: { clinics: [{ name: card.name, reason: card.reason }] },
    };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [toolUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(
        fakeTurn([textDelta('Das passt zu dir:')], {
          content: [{ type: 'text', text: 'Das passt zu dir:' }],
          stop_reason: 'end_turn',
        }),
      );
    const executeRecommendClinics = vi
      .fn()
      .mockResolvedValue({ json: '{"shown":1}', recommendations: [card] });
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
      executeRecommendClinics,
    };

    const run = runChat(deps, DEFAULT_CHAT_SETTINGS, [userMessage]);
    const events = await readEvents(run.stream);
    expect(events).toContainEqual({ t: 'clinics', v: [card] });
    await expect(run.result).resolves.toMatchObject({ recommendations: [card] });
  });

  it('routes each tool call to its own executor', async () => {
    const toolUse = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'recommend_clinics',
      input: { clinics: [{ name: card.name, reason: card.reason }] },
    };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [toolUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [], stop_reason: 'end_turn' }));
    const executeRecommendClinics = vi
      .fn()
      .mockResolvedValue({ json: '{"shown":1}', recommendations: [card] });
    const tools = unusedTools();
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...tools,
      executeRecommendClinics,
    };

    await readEvents(runChat(deps, DEFAULT_CHAT_SETTINGS, [userMessage]).stream);
    expect(executeRecommendClinics).toHaveBeenCalledTimes(1);
    expect(tools.executeSearchClinics).not.toHaveBeenCalled();
  });

  it('emits no clinics frame when the model recommends only unknown names', async () => {
    const toolUse = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'recommend_clinics',
      input: { clinics: [{ name: 'Erfunden', reason: 'x' }] },
    };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [toolUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [], stop_reason: 'end_turn' }));
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
      executeRecommendClinics: vi
        .fn()
        .mockResolvedValue({ json: '{"shown":0,"unknown":["Erfunden"]}', recommendations: [] }),
    };

    const events = await readEvents(runChat(deps, DEFAULT_CHAT_SETTINGS, [userMessage]).stream);
    expect(events.filter((event) => event.t === 'clinics')).toEqual([]);
  });
});
