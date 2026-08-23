import { describe, expect, it } from 'vitest';

import type { ChatMessage } from './schema';
import { readTranscriptFacts } from './transcript-facts';

function transcript(...contents: string[]): ChatMessage[] {
  return contents.map((content) => ({ role: 'user' as const, content }));
}

describe(readTranscriptFacts, () => {
  it('returns the transcript untouched', async () => {
    const original = transcript('Ich wohne in 50667 Köln und heiße Anna Beispiel.');
    await expect(readTranscriptFacts(original)).resolves.toMatchObject({
      status: 'ok',
      transcript: original,
    });
  });

  it('detects the legal area a visitor named', async () => {
    const facts = await readTranscriptFacts(transcript('Ich brauche Hilfe bei Mietrecht.'));
    expect(facts.legalArea).toBe('Mietrecht');
  });

  it('detects the region a visitor named', async () => {
    const facts = await readTranscriptFacts(transcript('Ich wohne in Bayern.'));
    expect(facts.city).toBe('Bayern');
  });

  it('ignores what only the assistant said', async () => {
    const facts = await readTranscriptFacts([
      { role: 'user', content: 'Hallo.' },
      { role: 'assistant', content: 'Geht es um Mietrecht in Bayern?' },
    ]);
    expect(facts).toMatchObject({ legalArea: null, city: null });
  });

  it('reports nothing when the transcript names neither', async () => {
    const facts = await readTranscriptFacts(transcript('Ich habe eine Frage.'));
    expect(facts).toMatchObject({ legalArea: null, city: null });
  });
});
