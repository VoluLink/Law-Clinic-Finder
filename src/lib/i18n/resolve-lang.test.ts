import { describe, expect, it } from 'vitest';

import { dirFor, isRtl } from './config';
import { resolveLang } from './resolve-lang';

describe(resolveLang, () => {
  it('uses a valid cookie value first', () => {
    expect(resolveLang('tr', 'fr-FR,fr;q=0.9')).toBe('tr');
  });

  it('rejects unknown cookie values and falls back to Accept-Language', () => {
    expect(resolveLang('xx', 'uk-UA,uk;q=0.9,en;q=0.8')).toBe('uk');
  });

  it('skips unsupported Accept-Language entries until one matches', () => {
    expect(resolveLang(undefined, 'zh-CN;q=1.0, fa;q=0.8')).toBe('fa');
  });

  it('falls back to German when nothing matches', () => {
    expect(resolveLang(undefined, 'zh-CN,ja;q=0.8')).toBe('de');
  });

  it('falls back to German without any input', () => {
    expect(resolveLang(undefined, null)).toBe('de');
  });
});

describe(isRtl, () => {
  it('marks Arabic and Farsi as right-to-left', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('fa')).toBe(true);
  });

  it('keeps the other languages left-to-right', () => {
    expect(dirFor('de')).toBe('ltr');
    expect(dirFor('ku')).toBe('ltr');
  });
});
