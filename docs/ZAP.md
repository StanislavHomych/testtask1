# OWASP ZAP scan guide (Vault)

Use this after `npm run dev:api` and `npm run dev:web` are up.

## What we hardened for ZAP

| Control | Detail |
| --- | --- |
| Helmet | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `HSTS`, etc. |
| CORS | Exact `FRONTEND_URL` only; limited methods/headers |
| Rate limit | Global throttling; stricter on `GET /api/shared/:token` |
| Swagger | Off when `NODE_ENV=production` unless `ENABLE_SWAGGER=true` |
| Authz | Room / folder / file share scopes no longer over-grant |
| Validation | Global whitelist + forbid unknown fields |

## Quick baseline scan (Docker)

```bash
# API passive/baseline against local Nest
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://host.docker.internal:3000/api \
  -r zap-api-report.html

# Web app
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://host.docker.internal:5173 \
  -r zap-web-report.html
```

On Linux, replace `host.docker.internal` with your LAN IP or `--network=host`.

## Authenticated API tips

1. Sign in via Clerk in the browser, copy a short-lived session JWT from the network tab (`Authorization: Bearer …` on `/api/users/me`).
2. In ZAP, add a Replacer / Authentication header for `/api/**` excluding `/api/shared/**` and `/api/health`.
3. Prefer **API scan** against OpenAPI: `http://localhost:3000/api/docs-json` (dev only).

## Expected residual findings (OK to explain)

| Finding | Why acceptable for MVP |
| --- | --- |
| Missing CSP on Vite dev server | Dev server; production static host should set CSP |
| HSTS on HTTP localhost | Helmet default; meaningful only behind HTTPS |
| Public `/api/health` | Intentional liveness |
| Info disclosure in JSON error `message` | Nest validation messages; no secrets |
| Token in URL path for public shares | Product requirement; use unguessable tokens (already) |

## Before production ZAP

```bash
# apps/api/.env
NODE_ENV=production
ENABLE_SWAGGER=false
FRONTEND_URL=https://your-frontend.example
```

Re-run baseline + authenticated spider against the **deployed** HTTPS origins, not only localhost.
