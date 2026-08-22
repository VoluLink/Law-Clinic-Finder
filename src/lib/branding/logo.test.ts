// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { normalizeLogo } from './logo';

const scriptedSvg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="10">
    <script>alert('stored xss')</script>
    <rect width="20" height="10" fill="#0d4b5b" />
  </svg>
`);

describe(normalizeLogo, () => {
  it('rasterizes SVG uploads so active content cannot be served', async () => {
    const result = await normalizeLogo(scriptedSvg, 'image/svg+xml');
    expect(result.subarray(1, 4).toString()).toBe('PNG');
  });

  it('rejects an unsupported media type', async () => {
    await expect(normalizeLogo(Buffer.from('gif'), 'image/gif')).rejects.toThrow(
      'unsupported logo type',
    );
  });

  it('rejects content that is not a real image', async () => {
    await expect(normalizeLogo(Buffer.from('not png'), 'image/png')).rejects.toThrow(
      'invalid logo image',
    );
  });
});
