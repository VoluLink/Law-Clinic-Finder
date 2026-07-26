import { describe, expect, it } from 'vitest';

import { resolveChatPresentation } from './chat-language';

describe('resolveChatPresentation', () => {
  it.each([
    ['Ich brauche Hilfe mit meinem Mietvertrag.', 'de'],
    ['I need help with my tenancy agreement.', 'en'],
    ["J'ai besoin d'aide pour mon bail.", 'fr'],
    ['Kirayla ilgili yardıma ihtiyacım var.', 'tr'],
    ['Мне нужна помощь с арендой.', 'ru'],
    ['Мені потрібна допомога з орендою.', 'uk'],
    ['أحتاج إلى مساعدة بشأن الإيجار.', 'ar'],
    ['برای اجاره به کمک نیاز دارم.', 'fa'],
    ['Ez alîkariya ji bo kirê dixwazim.', 'ku'],
  ] as const)('uses the matching preset language for %s', (text, lang) => {
    expect(resolveChatPresentation(text).lang).toBe(lang);
  });

  it.each(['Necesito ayuda con mi alquiler.', '賃貸契約について助けが必要です。'])(
    'uses English when %s is not a preset language',
    (text) => {
      const presentation = resolveChatPresentation(text);

      expect(presentation.lang).toBe('en');
      expect(presentation.dict.downloadPdf).toBe('As PDF');
    },
  );
});
