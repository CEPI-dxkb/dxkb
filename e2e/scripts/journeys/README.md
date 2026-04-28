# Scripted journey drivers

Each `<name>.ts` here exports a `drive(page, env)` function (or default export of the
same shape). `pnpm e2e:record <name>` looks the file up, launches headless Chromium
with HAR recording, and runs the driver against `E2E_RECORD_BASE_URL` (defaults to
`http://127.0.0.1:3010` — i.e. `pnpm start` against a production build, which proxies
the real BV-BRC backends). `pnpm dev` (Turbopack) is intentionally avoided here:
HMR plumbing blocks React hydration in headless Chromium, leaving the auth boundary
stuck in `loading` and the sign-in form unsubmittable. Run `pnpm build && pnpm start`
in another terminal first.

The resulting HAR lands in `e2e/fixtures/hars/<name>.har` and is consumed by specs
via `applyBackendMocks(page, { har: "<name>.har", overrides: [...] })`.

When no driver file exists for a journey name, the recorder falls back to launching
a headed browser and waiting for the operator to drive manually — same behaviour as
the original script.

## Conventions

- Drivers receive `{ baseURL, user, password }`. `user` / `password` come from
  `.env.e2e` (gitignored). Treat them as the test account; never commit creds.
- Wait for `networkidle` (or specific responses) before returning so the recorder
  actually captures the traffic. Returning early truncates the HAR.
- Keep journeys deterministic. A driver that depends on a particular workspace row
  existing will rot the moment the test account changes — capture only traffic that
  is structurally stable across re-records.
- Headless by default. Set `E2E_RECORD_HEADED=1` to debug a driver visually.

## Adding a new journey

1. Drop a `<name>.ts` in this directory exporting `drive(page, env)`.
2. `pnpm build && pnpm start` in another terminal so the production server is
   listening on `E2E_RECORD_BASE_URL` (default `http://127.0.0.1:3010`).
3. `pnpm e2e:record <name>` to capture.
4. Wire `e2e/fixtures/hars/<name>.har` into the relevant spec via
   `applyBackendMocks(page, { har, overrides })`.
5. Add the journey to the `journeys` matrix in
   `.github/workflows/e2e-har-refresh.yml` so the bi-weekly drift check covers it.
