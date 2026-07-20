import { cookies, headers } from 'next/headers';

import { LANG_COOKIE, type Lang } from './config';
import { resolveLang } from './resolve-lang';

export async function getRequestLang(): Promise<Lang> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLang(cookieStore.get(LANG_COOKIE)?.value, headerStore.get('accept-language'));
}
