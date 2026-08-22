import { describe, expect, it } from 'vitest';

import { confirmationPayloadFromFragment } from './confirmation-payload';

const ACTION_CODE = 'generated-action-code';
const STATE = 'A'.repeat(43);

describe(confirmationPayloadFromFragment.name, () => {
  it('parses a login confirmation fragment', () => {
    expect(confirmationPayloadFromFragment(`#oobCode=${ACTION_CODE}&state=${STATE}`)).toEqual({
      oobCode: ACTION_CODE,
      state: STATE,
    });
  });

  it('parses an email-change confirmation fragment', () => {
    expect(
      confirmationPayloadFromFragment(`#oobCode=${ACTION_CODE}&state=${STATE}&flow=email-change`),
    ).toEqual({ oobCode: ACTION_CODE, state: STATE, flow: 'email-change' });
  });

  it('rejects duplicate fields', () => {
    expect(
      confirmationPayloadFromFragment(
        `#oobCode=${ACTION_CODE}&state=${STATE}&state=${'B'.repeat(43)}`,
      ),
    ).toBeNull();
  });

  it('rejects unexpected fields', () => {
    expect(
      confirmationPayloadFromFragment(`#oobCode=${ACTION_CODE}&state=${STATE}&redirect=/admin`),
    ).toBeNull();
  });
});
