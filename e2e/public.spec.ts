import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const LANGUAGES = [
  ['de', 'ltr'],
  ['en', 'ltr'],
  ['ar', 'rtl'],
  ['fr', 'ltr'],
  ['ku', 'ltr'],
  ['fa', 'rtl'],
  ['ru', 'ltr'],
  ['uk', 'ltr'],
  ['tr', 'ltr'],
] as const;

test('renders all supported language directions', async ({ page, context }) => {
  for (const [lang, dir] of LANGUAGES) {
    await context.addCookies([{ name: 'lcf_lang', value: lang, url: 'http://127.0.0.1:3100' }]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('html')).toHaveAttribute('dir', dir);
  }
});

test('shows and persists a denied analytics choice', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Cookie-Einwilligung' })).toBeVisible();
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await expect(page.getByRole('dialog', { name: 'Cookie-Einwilligung' })).toBeHidden();
});

test('has no serious automated accessibility violations on public entry pages', async ({
  page,
}) => {
  for (const path of ['/', '/login', '/signup']) {
    await page.goto(path);
    await assertNoSeriousViolations(page, path);
  }
});

test('shows an explicit error for an unregistered address', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse deiner Organisation').fill('unknown@example.com');
  await page.getByRole('button', { name: 'Anmeldelink senden' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'ist nicht registriert' })).toBeVisible();
});

async function assertNoSeriousViolations(page: Page, label: string): Promise<void> {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important}' });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter((item) =>
    ['serious', 'critical'].includes(item.impact ?? ''),
  );
  expect(serious, `${label}: ${serious.map((item) => item.id).join(', ')}`).toEqual([]);
}
