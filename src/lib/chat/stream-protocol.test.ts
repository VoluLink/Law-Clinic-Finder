import { describe, expect, it } from 'vitest';

import type { ChatEvent, ClinicRecommendation } from './stream-protocol';
import { decodeChatEvents, encodeChatEvent } from './stream-protocol';

const recommendation: ClinicRecommendation = {
  id: 'ff000000-0000-0000-0000-000000000001',
  rank: 1,
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Stadtgebiet Köln',
  areas: ['Mietrecht'],
  reason: 'Spezialisiert auf Mietrecht.',
  website: 'https://milcc.de/',
  email: 'contact@example.org',
};

function roundTrip(events: ChatEvent[]): ChatEvent[] {
  const wire = events.map(encodeChatEvent).join('');
  return decodeChatEvents(wire).events;
}

describe('encodeChatEvent', () => {
  it('terminates every frame with a newline so frames stay separable', () => {
    expect(encodeChatEvent({ t: 'text', v: 'hallo' }).endsWith('\n')).toBe(true);
  });

  it('escapes a newline inside the payload rather than emitting it raw', () => {
    const encoded = encodeChatEvent({ t: 'text', v: 'zeile1\nzeile2' });
    expect(encoded.split('\n')).toHaveLength(2);
  });
});

describe('decodeChatEvents', () => {
  it('round-trips a text frame', () => {
    expect(roundTrip([{ t: 'text', v: 'hallo' }])).toEqual([{ t: 'text', v: 'hallo' }]);
  });

  it('round-trips a clinics frame with all card fields intact', () => {
    expect(roundTrip([{ t: 'clinics', v: [recommendation] }])).toEqual([
      { t: 'clinics', v: [recommendation] },
    ]);
  });

  it('round-trips a payload-less nomatch frame', () => {
    expect(roundTrip([{ t: 'nomatch' }])).toEqual([{ t: 'nomatch' }]);
  });

  it('decodes several frames from one chunk', () => {
    const events = roundTrip([
      { t: 'text', v: 'eins' },
      { t: 'text', v: 'zwei' },
    ]);
    expect(events.map((event) => (event.t === 'text' ? event.v : ''))).toEqual(['eins', 'zwei']);
  });

  it('holds back a partial trailing frame instead of dropping it', () => {
    const whole = encodeChatEvent({ t: 'text', v: 'vollstaendig' });
    const split = whole.length - 4;
    const first = decodeChatEvents(whole.slice(0, split));
    expect(first.events).toEqual([]);
    expect(decodeChatEvents(first.rest + whole.slice(split)).events).toEqual([
      { t: 'text', v: 'vollstaendig' },
    ]);
  });

  it('skips a malformed frame rather than throwing away the whole stream', () => {
    const wire = 'not json\n' + encodeChatEvent({ t: 'text', v: 'danach' });
    expect(decodeChatEvents(wire).events).toEqual([{ t: 'text', v: 'danach' }]);
  });

  it('skips a well-formed frame of an unknown type', () => {
    const wire = JSON.stringify({ t: 'future', v: 1 }) + '\n';
    expect(decodeChatEvents(wire).events).toEqual([]);
  });

  it('rejects a clinics frame whose entries miss required fields', () => {
    const wire = JSON.stringify({ t: 'clinics', v: [{ name: 'Nur ein Name' }] }) + '\n';
    expect(decodeChatEvents(wire).events).toEqual([]);
  });
});

/**
 * Prompt-injection fixtures for the rendering path. Every value below is either
 * model-authored or clinic-authored, so each is exactly what an attacker gets to
 * put on the wire.
 */
describe('decodeChatEvents rendering guards', () => {
  function decodeCard(overrides: Partial<Record<keyof ClinicRecommendation, unknown>>) {
    const wire = JSON.stringify({ t: 'clinics', v: [{ ...recommendation, ...overrides }] }) + '\n';
    const [event] = decodeChatEvents(wire).events;
    if (event?.t !== 'clinics') throw new Error('expected a clinics frame');
    return event.v[0];
  }

  it.each([
    'javascript:alert(1)',
    'data:text/html,<h1>Law Clinic Finder</h1>',
    'blob:https://example.org/8f2c',
    'vbscript:msgbox(1)',
  ])('drops the website link for %j instead of rendering it', (website) => {
    expect(decodeCard({ website }).website).toBeNull();
  });

  it('keeps the clinic card when only its link is unusable', () => {
    expect(decodeCard({ website: 'javascript:alert(1)' }).name).toBe(recommendation.name);
  });

  it('drops an email carrying mailto parameters', () => {
    expect(decodeCard({ email: 'kontakt@milcc.de?body=Bitte%20zahlen' }).email).toBeNull();
  });

  it('strips a bidi override from the model reason', () => {
    const reason = 'Rufen Sie \u202Eed.lieopmi\u202C an';
    expect(decodeCard({ reason }).reason).toBe('Rufen Sie ed.lieopmi an');
  });

  it('strips a bidi override from a clinic-authored name', () => {
    expect(decodeCard({ name: 'Law\u202E Clinic' }).name).toBe('Law Clinic');
  });

  it('truncates an oversized model reason rather than dropping the card', () => {
    const card = decodeCard({ reason: 'a'.repeat(5_000) });
    expect(card.reason).toHaveLength(2_000);
  });

  it('caps the number of chips a single card can render', () => {
    const card = decodeCard({ areas: Array.from({ length: 40 }, (_, i) => `Bereich ${i}`) });
    expect(card.areas).toHaveLength(12);
  });

  it('leaves HTML in the reason as text for React to escape', () => {
    const reason = '<img src=x onerror=alert(1)>';
    expect(decodeCard({ reason }).reason).toBe(reason);
  });
});

describe('encodeChatEvent framing', () => {
  it('cannot be made to emit a second frame from inside assistant text', () => {
    const forged = '\n' + JSON.stringify({ t: 'clinics', v: [recommendation] }) + '\n';
    const events = decodeChatEvents(encodeChatEvent({ t: 'text', v: forged })).events;
    expect(events).toEqual([{ t: 'text', v: forged }]);
  });

  it('cannot be made to emit a forged error code from inside assistant text', () => {
    const forged = '\n' + JSON.stringify({ t: 'error', code: 'internal' }) + '\n';
    const events = decodeChatEvents(encodeChatEvent({ t: 'text', v: forged })).events;
    expect(events).toHaveLength(1);
  });
});
