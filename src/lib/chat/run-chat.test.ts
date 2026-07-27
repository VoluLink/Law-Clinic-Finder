import { describe, expect, it, vi } from 'vitest';

import { makeChatSettings } from '@/lib/settings.fixtures';

import { runChat, type AnthropicLike } from './run-chat';
import { decodeChatEvents, type ChatEvent, type ClinicRecommendation } from './stream-protocol';

const settings = makeChatSettings();

type FakeEvent = { type: string; delta?: { type: string; text: string } };
type FakeFinal = {
  content: unknown[];
  stop_reason: string;
  usage?: { input_tokens: number; output_tokens: number };
};

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
  id: 'ff000000-0000-4000-8000-000000000001',
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
    executeListDirectoryTerms: vi.fn().mockRejectedValue(new Error('list terms not expected')),
  };
}

describe(runChat, () => {
  it('offers exactly the four registered database workflow tools to the model', async () => {
    const stream = vi.fn().mockReturnValue(fakeTurn([], { content: [], stop_reason: 'end_turn' }));
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
    };

    const run = runChat(deps, settings, [userMessage]);
    await readEvents(run.stream);

    expect(stream.mock.calls[0][0].tools.map((tool: { name: string }) => tool.name)).toEqual([
      'list_directory_terms',
      'search_clinics',
      'recommend_clinics',
      'report_no_match',
    ]);
  });

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

    const run = runChat(deps, settings, [userMessage]);
    expect(await readText(run.stream)).toBe('Hallo Welt');
    await expect(run.result).resolves.toMatchObject({
      assistantText: 'Hallo Welt',
      toolCallCount: 0,
      recommendations: [],
      model: settings.chat_model,
    });
  });

  it('separates text generated before and after a tool call', async () => {
    const toolUse = { type: 'tool_use', id: 'search-1', name: 'search_clinics', input: {} };
    const stream = vi
      .fn()
      .mockReturnValueOnce(
        fakeTurn([textDelta('Ich suche jetzt nach passenden Clinics.')], {
          content: [toolUse],
          stop_reason: 'tool_use',
        }),
      )
      .mockReturnValueOnce(
        fakeTurn([textDelta('Ich habe einen passenden Treffer gefunden.')], {
          content: [{ type: 'text', text: 'Ich habe einen passenden Treffer gefunden.' }],
          stop_reason: 'end_turn',
        }),
      );
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
      executeSearchClinics: vi.fn().mockResolvedValue(JSON.stringify({ count: 1, clinics: [] })),
    };

    const run = runChat(deps, settings, [userMessage]);

    expect(await readText(run.stream)).toBe(
      'Ich suche jetzt nach passenden Clinics. Ich habe einen passenden Treffer gefunden.',
    );
    await expect(run.result).resolves.toMatchObject({
      assistantText:
        'Ich suche jetzt nach passenden Clinics. Ich habe einen passenden Treffer gefunden.',
    });
  });

  it('executes the search tool and continues the conversation', async () => {
    const toolUse = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'search_clinics',
      input: { city: 'Berlin', legal_area: 'Mietrecht' },
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

    const run = runChat(deps, settings, [userMessage]);
    expect(await readText(run.stream)).toBe('Gefunden!');
    expect(executeSearchClinics).toHaveBeenCalledWith({ city: 'Berlin', legal_area: 'Mietrecht' });
    await expect(run.result).resolves.toMatchObject({
      toolCallCount: 1,
      matchedClinicCount: 2,
      detectedLegalArea: 'Mietrecht',
    });

    const secondCall = stream.mock.calls[1][0];
    expect(secondCall.messages).toHaveLength(3);
    expect(secondCall.messages[2].content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'tool-1',
    });
  });

  it('hands the directory vocabulary back to the model when it asks for it', async () => {
    const toolUse = { type: 'tool_use', id: 'tool-1', name: 'list_directory_terms', input: {} };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [toolUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(
        fakeTurn([textDelta('Alles klar.')], {
          content: [{ type: 'text', text: 'Alles klar.' }],
          stop_reason: 'end_turn',
        }),
      );
    const vocabulary = JSON.stringify({
      legal_areas: ['Mietrecht'],
      regions: [],
      languages: [],
      target_groups: [],
    });
    const executeListDirectoryTerms = vi.fn().mockResolvedValue(vocabulary);
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
      executeListDirectoryTerms,
    };

    await readEvents(runChat(deps, settings, [userMessage]).stream);
    expect(executeListDirectoryTerms).toHaveBeenCalledTimes(1);
    expect(stream.mock.calls[1][0].messages[2].content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'tool-1',
      content: vocabulary,
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

    const run = runChat(deps, settings, [userMessage]);
    await readEvents(run.stream);
    const secondCall = stream.mock.calls[1][0];
    expect(secondCall.messages[2].content[0]).toMatchObject({ is_error: true });
  });

  it('rejects an unregistered tool name without running a database query', async () => {
    const toolUse = { type: 'tool_use', id: 'tool-1', name: 'read_everything', input: {} };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [toolUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [], stop_reason: 'end_turn' }));
    const tools = unusedTools();
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...tools,
    };

    await readEvents(runChat(deps, settings, [userMessage]).stream);

    expect(tools.executeSearchClinics).not.toHaveBeenCalled();
    expect(tools.executeRecommendClinics).not.toHaveBeenCalled();
    expect(tools.executeListDirectoryTerms).not.toHaveBeenCalled();
    expect(stream.mock.calls[1][0].messages[2].content[0]).toMatchObject({ is_error: true });
  });

  it('rejects a recommendation id that was not returned by a search in this run', async () => {
    const searchUse = { type: 'tool_use', id: 'search-1', name: 'search_clinics', input: {} };
    const recommendUse = {
      type: 'tool_use',
      id: 'recommend-1',
      name: 'recommend_clinics',
      input: {
        clinics: [{ id: 'ff000000-0000-4000-8000-000000000099', reason: 'Nicht aus der Suche.' }],
      },
    };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [searchUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [recommendUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [], stop_reason: 'end_turn' }));
    const executeRecommendClinics = vi.fn();
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
      executeSearchClinics: vi.fn().mockResolvedValue(
        JSON.stringify({
          count: 1,
          clinics: [{ id: card.id }],
        }),
      ),
      executeRecommendClinics,
    };

    await readEvents(runChat(deps, settings, [userMessage]).stream);

    expect(executeRecommendClinics).not.toHaveBeenCalled();
    expect(stream.mock.calls[2][0].messages[4].content[0]).toMatchObject({ is_error: true });
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

    const run = runChat(deps, settings, [userMessage]);
    await readEvents(run.stream);
    await run.result;
    expect(stream.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('streams the chosen clinics as a structured frame the UI can render', async () => {
    const searchUse = { type: 'tool_use', id: 'search-1', name: 'search_clinics', input: {} };
    const recommendUse = {
      type: 'tool_use',
      id: 'recommend-1',
      name: 'recommend_clinics',
      input: { clinics: [{ id: card.id, reason: card.reason }] },
    };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [searchUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [recommendUse], stop_reason: 'tool_use' }))
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
      executeSearchClinics: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ count: 1, clinics: [{ id: card.id }] })),
      executeRecommendClinics,
    };

    const run = runChat(deps, settings, [userMessage]);
    const events = await readEvents(run.stream);
    expect(events).toContainEqual({ t: 'clinics', v: [card] });
    await expect(run.result).resolves.toMatchObject({ recommendations: [card] });
  });

  it('routes each tool call to its own executor', async () => {
    const searchUse = { type: 'tool_use', id: 'search-1', name: 'search_clinics', input: {} };
    const recommendUse = {
      type: 'tool_use',
      id: 'recommend-1',
      name: 'recommend_clinics',
      input: { clinics: [{ id: card.id, reason: card.reason }] },
    };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [searchUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [recommendUse], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [], stop_reason: 'end_turn' }));
    const executeRecommendClinics = vi
      .fn()
      .mockResolvedValue({ json: '{"shown":1}', recommendations: [card] });
    const tools = unusedTools();
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...tools,
      executeSearchClinics: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ count: 1, clinics: [{ id: card.id }] })),
      executeRecommendClinics,
    };

    await readEvents(runChat(deps, settings, [userMessage]).stream);
    expect(executeRecommendClinics).toHaveBeenCalledTimes(1);
    expect(deps.executeSearchClinics).toHaveBeenCalledTimes(1);
  });

  it('sums token usage across every turn of the run', async () => {
    const toolUse = { type: 'tool_use', id: 't1', name: 'search_clinics', input: {} };
    const stream = vi
      .fn()
      .mockReturnValueOnce(
        fakeTurn([], {
          content: [toolUse],
          stop_reason: 'tool_use',
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
      )
      .mockReturnValueOnce(
        fakeTurn([textDelta('Fertig')], {
          content: [{ type: 'text', text: 'Fertig' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 150, output_tokens: 30 },
        }),
      );
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
      executeSearchClinics: vi.fn().mockResolvedValue(JSON.stringify({ count: 0, clinics: [] })),
    };

    const run = runChat(deps, settings, [userMessage]);
    await readEvents(run.stream);
    await expect(run.result).resolves.toMatchObject({ inputTokens: 250, outputTokens: 50 });
  });

  it('emits a nomatch frame when the model reports it cannot help', async () => {
    const firstSearch = { type: 'tool_use', id: 'search-1', name: 'search_clinics', input: {} };
    const secondSearch = {
      type: 'tool_use',
      id: 'search-2',
      name: 'search_clinics',
      input: { query: 'weiter gefasst' },
    };
    const noMatch = { type: 'tool_use', id: 'nomatch-1', name: 'report_no_match', input: {} };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [firstSearch], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [secondSearch], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [noMatch], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [], stop_reason: 'end_turn' }));
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
      executeSearchClinics: vi.fn().mockResolvedValue(
        JSON.stringify({
          count: 0,
          clinics: [],
        }),
      ),
    };

    const events = await readEvents(runChat(deps, settings, [userMessage]).stream);
    expect(events).toContainEqual({ t: 'nomatch' });
  });

  it('rejects a no-match conclusion before two database searches', async () => {
    const noMatch = { type: 'tool_use', id: 'nomatch-1', name: 'report_no_match', input: {} };
    const stream = vi
      .fn()
      .mockReturnValueOnce(fakeTurn([], { content: [noMatch], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeTurn([], { content: [], stop_reason: 'end_turn' }));
    const deps = {
      anthropic: { messages: { stream } } as unknown as AnthropicLike,
      ...unusedTools(),
    };

    const events = await readEvents(runChat(deps, settings, [userMessage]).stream);

    expect(events).not.toContainEqual({ t: 'nomatch' });
    expect(stream.mock.calls[1][0].messages[2].content[0]).toMatchObject({ is_error: true });
  });

  it('emits no clinics frame when the model recommends only unknown ids', async () => {
    const toolUse = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'recommend_clinics',
      input: { clinics: [{ id: 'ff000000-0000-4000-8000-000000000099', reason: 'x' }] },
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

    const events = await readEvents(runChat(deps, settings, [userMessage]).stream);
    expect(events.filter((event) => event.t === 'clinics')).toEqual([]);
  });
});
