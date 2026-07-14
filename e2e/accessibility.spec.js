import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('core dashboard controls work with the keyboard and expose state', async ({ page }) => {
  await page.goto('/');

  const firstPhase = page.getByRole('button', { name: /01 - foundations/i });
  await expect(firstPhase).toHaveAttribute('aria-expanded', 'false');
  await firstPhase.focus();
  await page.keyboard.press('Enter');
  await expect(firstPhase).toHaveAttribute('aria-expanded', 'true');

  const firstTask = page.getByRole('checkbox').first();
  await expect(firstTask).not.toBeChecked();
  await firstTask.focus();
  await page.keyboard.press('Space');
  await expect(firstTask).toBeChecked();

  await page.locator('nav button').filter({ hasText: 'LOG' }).click();
  const trainingLog = page.getByRole('button', { name: /training log/i });
  await trainingLog.focus();
  await page.keyboard.press('Space');
  await expect(trainingLog).toHaveAttribute('aria-expanded', 'true');
});

test('semantic phase and task controls pass focused WCAG A checks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /01 - foundations/i }).click();

  const phaseResults = await new AxeBuilder({ page })
    .include('button[aria-controls^="phase-"]')
    .withTags(['wcag2a'])
    .analyze();
  const taskResults = await new AxeBuilder({ page })
    .include('input[type="checkbox"]')
    .withTags(['wcag2a'])
    .analyze();

  expect(phaseResults.violations).toEqual([]);
  expect(taskResults.violations).toEqual([]);
});

test('guest dashboard has no automatically detectable WCAG violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.length,
  }))).toEqual([]);
});
