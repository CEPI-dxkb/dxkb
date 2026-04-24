# E2E (Playwright)

Browser-driven end-to-end tests for DXKB V2. Complements the 134 Vitest files under `src/**` — Vitest still covers units, hooks, contexts, API routes, and auth internals. Playwright covers what jsdom can't: real browser rendering across Chromium/Firefox/WebKit, multi-page journeys with real cookies, file upload/drag-drop, 3D viewers, and visual regressions.

## Commands

```bash
pnpm e2e                       # Run all specs against all three browsers
pnpm e2e --project=chromium    # Run one browser
pnpm e2e:ui                    # Open Playwright UI runner
pnpm e2e:debug                 # Open the inspector
pnpm e2e:codegen               # Record selectors against a running app
pnpm e2e:report                # Open last HTML report
pnpm e2e:update-snapshots      # Regenerate visual baselines
pnpm e2e:record <journey>      # Record a HAR against live backend (manual, local only)
```

The suite runs against a **production build** on port `3020` (independent from `pnpm dev` on 3019 and `pnpm start` on 3010). Playwright's `webServer` config starts `next start -p 3020` automatically.

## Layout

```
e2e/
  auth/                         # Playwright setup projects (storageState generators)
    signed-in.setup.ts          # Seeds mocked auth cookies → e2e/.auth/user.json
    public.setup.ts             # Empty storageState for public specs
  mocks/
    backends.ts                 # applyBackendMocks(page, { har, overrides })
  fixtures/
    hars/                       # Recorded HAR files (committed)
    overrides/                  # Hand-written JSON overrides (committed)
  scripts/
    record-har.ts               # Manual HAR recorder
  tests/
    auth.spec.ts                # Sign-in redirects, protected route guards
    public.spec.ts              # /, /services, /workspace/public, footer pages
    workspace.spec.ts           # Signed-in workspace browsing
    services/*.spec.ts          # One file per service category
    jobs.spec.ts                # Jobs list + detail
    visual/visual.spec.ts       # Screenshot baselines
  __snapshots__/                # Visual regression baselines (per browser)
```

## Mocking strategy

All `/api/**` and outbound HTTPS to `*.patricbrc.org`, `*.bv-brc.org`, `*.theseed.org`, `*.ncbi.nlm.nih.gov` are mocked. Three layers (registered into the Playwright routing stack in this order so LIFO precedence gives overrides the first shot):

1. **JSON overrides** (`e2e/fixtures/overrides/*`) — hand-written responses. Highest precedence.
2. **HAR replay** (`page.routeFromHAR`) — recorded traffic. Runs after overrides via `notFound: "fallback"`.
3. **Strict guard** — any backend request not matched by the above is aborted with `route.abort("failed")` and logged as `[applyBackendMocks/strict]` to the test output.

Non-backend requests (Next.js assets, fonts, CDN) always pass through regardless of strict mode.

Call `applyBackendMocks(page, { overrides, har? })` in a `beforeEach`. **Strict is the default.** If you genuinely need to let real backend calls through for an exploratory test, pass `strict: false`.

The permissive catch-all `permissiveBackendOverrides` (from `e2e/fixtures/overrides`) covers `/api/auth/`, `/api/services/`, `/api/workspace/`, and the four backend hosts with generic 200 responses — use it as the last spread in your override list for the "I just want the page to render" case, after specific fixtures.

## Recording a HAR

1. `cp .env.e2e.example .env.e2e` and fill in valid BV-BRC creds (never commit).
2. In one shell: `pnpm dev`.
3. In another: `pnpm e2e:record workspace-home`.
4. A headed Chromium opens. Sign in, drive the flow you want to capture.
5. Press Enter in the terminal to close. The HAR lands in `e2e/fixtures/hars/workspace-home.har`.
6. Commit the HAR. Re-record when the API contract drifts.

## Visual regression

Baselines live in `e2e/__snapshots__/`, one per `(spec, browser, platform)` triple. Chromium is strict (zero-pixel diff). Firefox and WebKit allow `maxDiffPixelRatio: 0.05` to absorb font/AA differences.

We commit both `*-linux.png` (for CI on `ubuntu-latest`) and `*-darwin.png` (for local Macs) so visual tests work out of the box on both. Windows contributors regenerate their own `*-win32.png` locally and are not expected to commit them.

### Regenerate on macOS

For intentional UI changes, first refresh your local (Darwin) baselines:

```bash
pnpm e2e:update-snapshots
git add e2e/__snapshots__
```

### Regenerate Linux baselines (for CI)

CI runs on `ubuntu-latest` (Noble 24.04, amd64). Match that environment with the Playwright Docker image:

```bash
docker run --rm --platform linux/amd64 --init \
  -v "$PWD:/app" \
  -v /app/node_modules \
  -v /app/.next \
  -w /app \
  -e CI=true \
  mcr.microsoft.com/playwright:v1.59.1-noble \
  bash -c "corepack enable && pnpm install --frozen-lockfile && pnpm exec playwright install chromium firefox webkit && pnpm e2e:update-snapshots"
```

The anonymous `node_modules` and `.next` volumes keep your host's macOS install untouched. Commit the resulting `*-linux.png` files alongside the Darwin ones.

Review the PNG diffs in the PR before merging.

## Browser matrix

Every PR runs three jobs via GitHub Actions (`.github/workflows/pnpm-e2e.yml`): chromium, firefox, webkit. Each shard caches its own browser binary in `~/.cache/ms-playwright`. Reports upload as artifacts on failure.

## Agents: driving the app interactively

Two paths, depending on what the agent needs to do.

**Playwright MCP (preferred for exploration)** — the `plugin:playwright` MCP server is available in this repo's Claude sessions:

```text
1. Start the dev server:  pnpm dev
2. Use browser_navigate:  http://localhost:3019
3. Use browser_snapshot, browser_click, browser_type, etc.
```

**Pnpm scripts (for running the suite)** — use the `pnpm e2e*` commands above from a Bash tool.

## When to add a Playwright test vs a Vitest test

- **Vitest** for: pure functions, hooks, contexts, API route handlers, components that render fine in jsdom.
- **Playwright** for: multi-page flows, real-cookie auth, file upload, drag/drop, 3D viewer, iframes, CSS/layout regressions, cross-browser parity.

If a single render-and-assert test would pass in jsdom, keep it in Vitest. Playwright is for journeys and browser-level truth.
