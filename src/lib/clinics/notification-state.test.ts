import { describe, expect, it } from 'vitest';

import { owesPublicationNotice, owesSubmissionNotice } from './notification-state';

const NOTIFIED = new Date('2026-08-20T10:00:00.000Z');

describe(owesSubmissionNotice.name, () => {
  it('announces the first save of an unpublished entry', () => {
    expect(owesSubmissionNotice({ isPublished: false, submissionNotifiedAt: null })).toBe(true);
  });

  it('stays silent on a later save of the same unpublished entry', () => {
    expect(owesSubmissionNotice({ isPublished: false, submissionNotifiedAt: NOTIFIED })).toBe(
      false,
    );
  });

  it('stays silent while the entry is already published', () => {
    expect(owesSubmissionNotice({ isPublished: true, submissionNotifiedAt: null })).toBe(false);
  });
});

describe(owesPublicationNotice.name, () => {
  it('announces the transition from unpublished to published', () => {
    expect(
      owesPublicationNotice({
        wasPublished: false,
        willBePublished: true,
        publishNotifiedAt: null,
      }),
    ).toBe(true);
  });

  it('never announces a second publication', () => {
    expect(
      owesPublicationNotice({
        wasPublished: false,
        willBePublished: true,
        publishNotifiedAt: NOTIFIED,
      }),
    ).toBe(false);
  });

  it('stays silent when an already published entry is only edited', () => {
    expect(
      owesPublicationNotice({ wasPublished: true, willBePublished: true, publishNotifiedAt: null }),
    ).toBe(false);
  });

  it('stays silent when an entry is withdrawn', () => {
    expect(
      owesPublicationNotice({
        wasPublished: true,
        willBePublished: false,
        publishNotifiedAt: null,
      }),
    ).toBe(false);
  });
});
