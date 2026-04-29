# Scripted journey drivers

Each `<name>.ts` here exports a `drive(page, env)` function (or default export of the
same shape). `pnpm e2e:record <name>` looks the file up, launches headless Chromium
with HAR recording, and runs the driver against `E2E_RECORD_BASE_URL` (defaults to
`http://127.0.0.1:3010` — i.e. `pnpm start` against a production build, which proxies
the real BV-BRC backends). `pnpm dev` (Turbopack) is intentionally avoided here:
HMR plumbing blocks React hydration in headless Chromium, leaving the auth boundary
stuck in `loading` and the sign-in form unsubmittable. Run `pnpm build && pnpm start`
in another terminal first.

The resulting HAR lands in `e2e/fixtures/hars/<name>.har`. How a spec consumes it
depends on what the spec is asserting:

- **Auth-shape contract test:** `applyBackendMocks(page, { har: "<name>.har", overrides: [] })`.
  Routes the entire HAR through `page.routeFromHAR` (URL + method + strict POST-body
  match). Use this only when the spec replays the recorded auth payload itself —
  `auth.spec.ts` against `auth-sign-in.har` is the canonical example.
- **Body-aware journey replay (everything else):** `harOverridesFor("<name>.har")`
  from `../scripts/har-overrides`. `routeFromHAR` matches URL + method only and
  cannot disambiguate the four-plus JSON-RPC methods that share
  `/api/services/workspace`, so a `{ har }` wiring would serve the first recorded
  response for every workspace call. `harOverridesFor` parses the HAR and emits one
  override per `(path, method, JSON-RPC method)` tuple, with `matchBody` fanning the
  RPC entry point out by request `method`. This is what the workspace, viewer,
  upload, jobs, and service-submit replay specs use; see `e2e/README.md` ("Wiring a
  HAR into a spec") for the full rationale.

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

## Catalogue of journeys

The `e2e-har-refresh` workflow refreshes these on a schedule (read-only) or on
manual dispatch (write). Drivers share `_helpers/sign-in.ts` so the auth flow
lives in one place.

| Journey | Group | What it captures | Notes |
|---|---|---|---|
| `auth-sign-in` | read-only | `/api/auth/sign-in/email`, `/api/auth/get-session` | The bare auth surface. |
| `workspace-browse` | read-only | `Workspace.ls`, `Workspace.get` for `favorites.json` | Lands on the test user's home. |
| `workspace-viewer` | read-only | `/api/workspace/view/<path>` for a seeded text file | Requires a seeded `home/e2e-fixtures/readme.txt` on the test account. |
| `jobs-lifecycle` | read-only | `enumerate-tasks-filtered` + sidebar counters | List page only — no row select / kill. |
| `service-submit` | read-only | genome-assembly form-load traffic | Does NOT click submit. See driver doc-comment. |
| `workspace-upload` | **write** | `POST /api/services/workspace/upload` + post-upload `Workspace.ls` | Writes a `recorded-<timestamp>.txt` file under `home/.e2e-records/`. Manual dispatch only. |

Read-only journeys re-record on the bi-weekly cron. Write journeys only run
when a maintainer triggers `workflow_dispatch` with `include_write: true`,
because they create remote state on the test account every run.

## Test-account seeding

Some drivers need fixtures pre-existing on the BV-BRC test user. Seed once
via the workspace UI:

- `home/e2e-fixtures/readme.txt` — any small ASCII text file (< 1 KB).
  Required by `workspace-viewer`.
- `home/.e2e-records/` — empty folder. Required by `workspace-upload` as the
  upload destination so files don't clutter the home listing.

If a driver fails because the seeded fixture is missing, re-seed and re-run
rather than rewriting the driver to dodge the dependency — the alternative
is HARs that depend on whatever the test account happened to contain that
day, which yanks the recording every refresh.

## Adding a new journey

1. Drop a `<name>.ts` in this directory exporting `drive(page, env)`. Reuse
   `_helpers/sign-in.ts` for any signed-in surface.
2. `pnpm build && pnpm start` in another terminal so the production server is
   listening on `E2E_RECORD_BASE_URL` (default `http://127.0.0.1:3010`).
3. `pnpm e2e:record <name>` to capture.
4. Wire `e2e/fixtures/hars/<name>.har` into the relevant spec — use
   `harOverridesFor("<name>.har")` for body-aware journey replay, or the `{ har }`
   option only for auth-shape contract tests (see the modes described above).
5. Add the journey to the right group in `.github/workflows/e2e-har-refresh.yml`'s
   matrix:
   - `read-only` group → covered by the cron automatically.
   - `write` group → manual `workflow_dispatch` with `include_write: true`.
