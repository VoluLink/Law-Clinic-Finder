import { describe, expect, it } from 'vitest';

import type { ChatEvent, ClinicRecommendation } from './stream-protocol';
import { decodeChatEvents, encodeChatEvent } from './stream-protocol';

const recommendation: ClinicRecommendation = {
  rank: 1,
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Stadtgebiet Köln',
  areas: ['Mietrecht'],
  reason: 'Spezialisiert auf Mietrecht.',
  website: 'https://milcc.de/',
  email: 'kontakt@milcc.de',
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
