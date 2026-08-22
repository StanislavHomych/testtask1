import { expect, test } from '@playwright/test'

test.describe('Public shared resource', () => {
  test('shows a clear error for an invalid share token', async ({ page }) => {
    await page.goto('/shared/this-token-does-not-exist')

    await expect(
      page.getByRole('heading', { name: 'Shared resource' }),
    ).toBeVisible()
    await expect(
      page.getByText(/invalid, expired, or revoked/i),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: 'Go home' })).toBeVisible()
  })
})
