import { expect, test, type APIRequestContext } from '@playwright/test'

const apiBase = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000/api'

async function tryGet(request: APIRequestContext, path: string) {
  try {
    return await request.get(`${apiBase}${path}`)
  } catch {
    return null
  }
}

test.describe('API smoke (optional)', () => {
  test('health endpoint reports database up when API is running', async ({
    request,
  }) => {
    const response = await tryGet(request, '/health')
    test.skip(!response, 'API is not running — start with npm run dev:api')

    expect(response!.ok()).toBeTruthy()
    const body = await response!.json()
    expect(body).toMatchObject({
      status: 'ok',
      database: 'up',
    })
  })

  test('OpenAPI JSON is published', async ({ request }) => {
    const response = await tryGet(request, '/docs-json')
    test.skip(!response, 'API is not running — start with npm run dev:api')

    expect(response!.ok()).toBeTruthy()
    const body = await response!.json()
    expect(body.info?.title).toBe('Vault API')
    expect(
      body.paths?.['/api/health'] ?? body.paths?.['/health'],
    ).toBeTruthy()
  })
})
