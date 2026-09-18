# a11y Suite Runbook

Accessibility tests for DXKB — WCAG 2.1 Level AA gate.

## Quick start

```bash
pnpm build               # required before any a11y run
pnpm a11y                # full chromium-deep sweep (all specs)
pnpm a11y:routes         # broad route sweep only
pnpm a11y:deep           # deep tier (interaction states)
pnpm a11y:keyboard       # keyboard / focus / no-trap tests
pnpm a11y:primitives     # Vitest browser-mode primitive isolation
pnpm a11y:tripwire       # webkit + firefox cross-engine smoke
pnpm a11y:motion         # prefers-reduced-motion assertion
pnpm a11y:mobile         # Pixel 5 viewport sweep of the mobile-flagged routes
pnpm a11y:meta           # route-registry accounting + suppression-key hygiene
```

`.github/workflows/pnpm-a11y.yml` has a job for `a11y:routes`, `a11y:deep`,
`a11y:keyboard`, `a11y:tripwire` and `a11y:primitives`, plus `a11y:meta` as a
step of the routes-sweep job — so the registry-drift guardrail does not depend
on the Firefox tripwire. `a11y:motion` and `a11y:mobile` have **no** CI job and
are local-only gates today; run them before pushing a change that touches
animation or responsive layout.

`a11y:meta` is the one Playwright script that needs neither a build nor a browser: it runs
under `playwright.a11y.meta.config.ts`, which declares no `webServer` and no
storage state. That config also owns its own `outputDir`
(`.misc/a11y-meta-results/`) and report path (`.misc/a11y-meta-report/`), so it
cannot clear or overwrite the sweep's traces, screenshots and JSON — the two can
run in either order.

## Artifacts

| Path | Written by | Contents |
|---|---|---|
| `.misc/a11y-results/` | the Playwright `a11y:*` scripts other than `a11y:meta` (not `a11y:primitives`, which is Vitest) | Playwright `outputDir`: traces, screenshots, videos. Cleared at the start of each run. |
| `.misc/a11y-report/results.json` | the same scripts, under `CI=true` | JSON reporter output. Rewritten each run. |
| `.misc/a11y-report/html/` | the same scripts | HTML report (`pnpm a11y:report`). |
| `.misc/a11y-report/a11y-summary.json` | `teardown.ts` | Per-route/theme scan summary for **one** invocation. `pnpm a11y:baseline:update` reads it, so run the sweep immediately before that script. |
| `.misc/a11y-meta-results/`, `.misc/a11y-meta-report/` | `a11y:meta` only | Kept separate on purpose — see above. |

Only the scan records are per-invocation. `results.json` and
`a11y-summary.json` are single files, so two sweeps running at the same time
would overwrite each other's copy. That is not *why* the heavy suites run
sequentially — that rule is about resource contention on the dev machine — but
it is one more reason not to overlap them. CI runs one sweep per job. What the split below guarantees is that `a11y:meta` can never be
the run that does the overwriting.

Scan records are written to `.misc/a11y-report/scans/<A11Y_RUN_ID>/` and the
global teardown aggregates and removes only that directory. `setup.ts` assigns
the id in the config process before any worker forks, which is how every worker
and the teardown agree on it. Identical retry records are deduplicated; conflicting
records with the same route/theme key fail teardown so two surfaces cannot silently
share a baseline. A run that records no scans (for example a setup-project-only
invocation) leaves the previous summary untouched rather than replacing it with an
empty one.

## Architecture

| File | Purpose |
|---|---|
| `gate.ts` | Block/warn classifier — single source of truth for severity rules |
| `baseline.ts` + `baseline.generated.ts` | Per-route baseline suppression (ticketed, maxNodes) |
| `axe-scan.ts` | AxeBuilder factory: tag set, vendor exclusions, formatters |
| `settle.ts` | `awaitSettled()` — networkidle + fonts.ready + zero-skeleton |
| `theme.ts` | `forEachTheme()` — light/dark in-test loop |
| `routes.ts` | Route entry types + the route table, plus the `coveredPageFiles` and `scanTargets` views derived from it |
| `scan-keys.ts` | The set of valid baseline/`reflowSkip` keys + the stale-key guard `coverage.meta.spec.ts` runs |
| `report.ts` | `recordScan()` + the artifact paths; writes one uniquely named JSON record per scan under the current run id |
| `setup.ts` / `teardown.ts` | Playwright global setup/teardown: stamp the invocation, then aggregate its scans into `a11y-summary.json` |

## Gate rules

```
block if:  (tier == core  && impact in {moderate, serious, critical})
        || (any tier      && impact == critical)
warn  otherwise
```

**Core tags** (blocking tier): `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`
**Extra tags** (warn tier): `best-practice`, `wcag22aa`
**Excluded**: `experimental`

## Baseline

`baseline.generated.ts` holds per-route suppressions for known structural violations:

```ts
{
  "route-name": {
    "dxkb-light": { "rule-id": { maxNodes: N, ticket: "DXKBCORE-xxx" } },
    "dxkb-dark":  { "rule-id": { maxNodes: N, ticket: "DXKBCORE-xxx" } },
  }
}
```

Rules:
- **Critical violations may NEVER be baselined.**
- Every entry requires a `ticket` reference.
- The `"*"` wildcard route applies to all routes lacking a specific entry.
- Run `pnpm a11y:baseline:update` (Phase 2) to regenerate counts from a live run.

## Adding a new route

Add one entry to the `routes` array in `routes.ts`. Nothing else needs editing —
`routes-sweep.spec.ts` derives its scan list from `scanTargets` and
`coverage.meta.spec.ts` derives page accounting from `coveredPageFiles`, both
exported from that same table.

- **`pages`** is required: list every `src/app` `page.tsx` the entry accounts for,
  relative to `src/app/`. This is the only coverage list, and `coverage.meta.spec.ts`
  diffs it against the files on disk in both directions — a new page with no owning
  entry fails, and a declared file that no longer exists fails with the owning route
  named. A page.tsx may be claimed by only one entry.
- **`redirectOnly: true`** for a path that always redirects: counted for accounting,
  never scanned. Its redirect target needs its own entry.
- **`settle`** owns *generic* readiness — load state, `document.fonts.ready`,
  skeleton detach. `awaitSettled()` already awaits `loadState ?? "networkidle"`
  before any hook runs, so never put `waitForLoadState("networkidle")` in a hook.
  Use `loadState: "domcontentloaded"` on pages whose rolling RSC prefetch means
  networkidle is never reached. `skeletonSelector` is available for the case where
  readiness is a skeleton detaching rather than the network going quiet, but no
  `routes.ts` entry sets it today — the sweep's `DataTable` routes reach networkidle
  once their first page of rows lands, so they settle without it. The specs that
  interact with a table after load pass it to `awaitSettled()` directly instead (see
  `tests/a11y/deep-tier.spec.ts`, where skeleton `<tr>` placeholders satisfy
  `waitForRows()` and caused a real flake). Reach for it on a route entry only if a
  sweep route starts scanning a loading state.
- **`prepare`** is reserved for *observable, page-specific* readiness: an element
  that must exist before axe scans, or a redirect that must have landed.
- **`variants`** produce one scan each, keyed `${name}/${nameSuffix}`, and the
  parent is not scanned on its own. A variant's `prepare` runs *after* the parent's,
  not instead of it, so only put on the parent what is true of every variant.

Route and variant names are the `baseline.generated.ts` and `reflowSkip` keys.
Renaming one stops its suppressions from matching, so update both maps in the
same change — `pnpm a11y:meta` now fails with the offending key named if you
forget. Giving an entry `variants` counts as a rename: the keys become
`${name}/${nameSuffix}` and the bare name matches nothing.

Keys that are not route names (component surfaces in `routes-sweep.spec.ts`,
interaction states in `deep-tier.spec.ts`) are enumerated in `nonRouteScanKeys`
(`scan-keys.ts`); the baseline wildcard `"*"` is accepted there too. `reflowSkip`
has no wildcard — `isReflowSkipped` tests plain key membership — so a `"*"` in
that map is reported as stale rather than treated as global.

## Vendor widgets

Molstar, CodeMirror, and visx SVG internals are excluded via `vendorExclusions` in
`axe-scan.ts`. The wrapping element (e.g. `[data-molstar-viewer]`) must still carry
an accessible name — tested separately in `deep-tier.spec.ts`.

## CI

`pnpm-a11y.yml` runs five parallel jobs: routes-sweep (which also runs
`a11y:meta`), deep-tier, keyboard, the webkit+firefox tripwire, and the
Vitest-browser-mode primitives. All five run on every PR targeting `main`,
`test` or `dev`; which checks are *required* to merge is branch protection, and
`.claude/rules/testing.md` names the core four. Report artifacts are uploaded
per job (14-day retention).

No job seeds the auth state as a separate step: every a11y *browser* project declares
`dependencies: ["a11y-setup-signed-in"]`, so Playwright runs that setup project
to completion first. An explicit step only re-ran a setup that was already
guaranteed to have run.
