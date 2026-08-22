import { expect, test } from '@playwright/test'

test.describe('Marketing landing', () => {
  test('renders brand hero and primary CTAs', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('paragraph').filter({ hasText: /^Vault$/ }).first()).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: /A modern approach to secure data rooms/i,
      }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get started' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible()
  })

  test('expands FAQ answers', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { name: 'Frequently asked questions' }).scrollIntoViewIfNeeded()

    const question = page.getByRole('button', { name: /What is Vault\?/i })
    await question.click()
    await expect(
      page.getByText(/virtual data room for teams that need to organize sensitive PDFs/i),
    ).toBeVisible()
  })

  test('anchors FAQ from footer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'FAQ' }).click()
    await expect(page).toHaveURL(/#faq/)
    await expect(
      page.getByRole('heading', { name: 'Frequently asked questions' }),
    ).toBeVisible()
  })
})
