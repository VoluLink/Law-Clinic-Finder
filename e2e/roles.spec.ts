import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test('redirects a signed-out visitor away from the admin portal', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
});

test.describe('admin session', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('reaches the dashboard and alert selector', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/smtp');
    await expect(page.getByText('Admin-Benachrichtigungen')).toBeVisible();
    await expect(page.getByRole('radio', { name: /admin@example\.com/i })).toBeChecked();
  });

  test('opens the SMTP screen read-only while no secret version is reachable', async ({ page }) => {
    await page.goto('/admin/smtp');
    await expect(page.getByRole('heading', { name: 'Serververbindung' })).toBeVisible();
    await expect(page.getByLabel('Host')).toBeDisabled();
    await expect(page.getByRole('button', { name: /Prüfen/ })).toBeDisabled();
  });

  test('rejects an SMTP change without an idempotency key', async ({ page }) => {
    const response = await page.request.put('/api/admin/smtp', {
      data: {
        host: 'smtp.example.net',
        port: 587,
        tlsMode: 'starttls',
        loginEmail: 'login@example.net',
        fromEmail: 'no-reply@example.net',
        fromName: 'Law Clinics',
      },
      headers: { origin: 'http://127.0.0.1:3100' },
    });
    expect(response.status()).toBe(400);
  });

  test('has no serious automated accessibility violations', async ({ page }) => {
    await page.goto('/admin');
    await assertNoSeriousViolations(page, 'admin');
  });

  test('has no serious accessibility violations on the SMTP screen', async ({ page }) => {
    await page.goto('/admin/smtp');
    await assertNoSeriousViolations(page, 'admin/smtp');
  });

  // The dashboard tiles used to widen past the viewport, which left the sticky
  // header and page background ending mid-scroll. A page must never scroll
  // sideways; wide content scrolls inside its own container instead.
  for (const width of [360, 768, 1024]) {
    test(`does not scroll sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/admin', '/admin/clinics', '/admin/logs']) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe('clinic session', () => {
  test.use({ storageState: 'e2e/.auth/clinic.json' });

  test('is denied access to admin pages and APIs', async ({ page }) => {
    await page.goto('/clinic');
    await expect(page).toHaveURL(/\/clinic$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/clinic$/);
    const response = await page.request.put('/api/admin/operational-alerts', {
      data: { userId: '11111111-1111-4111-8111-111111111111' },
      headers: { origin: 'http://127.0.0.1:3100' },
    });
    expect(response.status()).toBe(403);
    const smtp = await page.request.get('/api/admin/smtp', {
      headers: { origin: 'http://127.0.0.1:3100' },
    });
    expect(smtp.status()).toBe(403);
  });

  test('has no serious automated accessibility violations', async ({ page }) => {
    await page.goto('/clinic');
    await assertNoSeriousViolations(page, 'clinic');
  });
});

async function assertNoSeriousViolations(page: Page, label: string): Promise<void> {
  // Only stabilises animations. A blocked third-party beacon can reject this
  // call, which must never decide the accessibility result below.
  await page
    .addStyleTag({ content: '*,*::before,*::after{animation:none!important}' })
    .catch(() => undefined);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter((item) =>
    ['serious', 'critical'].includes(item.impact ?? ''),
  );
  expect(serious, `${label}: ${serious.map((item) => item.id).join(', ')}`).toEqual([]);
}
