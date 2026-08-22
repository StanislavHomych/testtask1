# Presentation guide — Vault

Live walkthrough sheet. Brand in the UI: **Vault**.

## Before you present (2 minutes)

- [ ] `npm run dev` (or `dev:api` + `dev:web`) — both healthy
- [ ] `GET http://localhost:3000/api/health` → `database: up`
- [ ] Sample PDF ≤50MB ready
- [ ] Two Clerk users ready (second user must have signed in **once**)
- [ ] Incognito/private window for public-link demo
- [ ] Do **not** screen-share `.env` files

## URLs

| Surface | URL |
| --- | --- |
| Marketing / app | http://localhost:5173 |
| OpenAPI | http://localhost:3000/api/docs |
| Health | http://localhost:3000/api/health |

## 5-minute demo script

1. **Landing (signed out)** — Brand **Vault**, one headline, CTAs. Scroll: trust → product → how it works → FAQ.
2. **Auth** — Sign up / Log in (Clerk). App shell appears.
3. **Create a data room** — Dashboard → create → root folder.
4. **Folders** — Nest folders, rename, breadcrumbs (one level at a time).
5. **Upload PDF** — Upload → open preview (presigned view URL; Nest never proxies the file).
6. **Share by email** — Invite second user as VIEWER → open as them (read-only).
7. **Public link** — Create link → Copy → open in private window → revoke → reload fails cleanly.
8. **Optional** — `/api/docs` + health; mention Helmet, rate limits, hashed public tokens.

## Talking points (30–60s)

- Modular monolith: React + Nest + Prisma/Neon + S3
- Authz on the server: owner → room/folder share → public token → deny
- File share ≠ whole room; breadcrumbs clipped at share root
- Uploads: browser → S3; short-lived presigned URLs; private bucket
- Scale path: cursor pagination, one-level lists, indexes; EDITOR already in schema

## Known limits (own them)

- Upload UI is single-file for the MVP
- Email invite needs an existing local user (sign-in once)
- Deploy is local/dev-oriented; production is a follow-up

## Q&A

**Why not proxy PDFs through Nest?** Bandwidth, memory, timeouts — S3 is the blob plane.

**Why VIEWER only?** `EDITOR` exists in the schema; policies can widen without a migration.

**Why hash public tokens?** A DB leak must not reveal usable raw tokens.

**How do you scale listings?** Stable cursors + one level per request — never load 100k rows.

## Tests to mention

```bash
npm test
npm run test:e2e
```
