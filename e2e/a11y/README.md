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
pnpm a11y:meta           # route-registry coverage accounting only
```

Every script above except `pnpm a11y` itself has a CI job in
`.github/workflows/pnpm-a11y.yml`; `a11y:meta` runs as a second step of the
routes-sweep job, so the registry-drift guardrail does not depend on the
Firefox tripwire.

## Architecture

| File | Purpose |
|---|---|
| `gate.ts` | Block/warn classifier — single source of truth for severity rules |
| `baseline.ts` + `baseline.generated.ts` | Per-route baseline suppression (ticketed, maxNodes) |
| `axe-scan.ts` | AxeBuilder factory: tag set, vendor exclusions, formatters |
| `settle.ts` | `awaitSettled()` — networkidle + fonts.ready + zero-skeleton |
| `theme.ts` | `forEachTheme()` — light/dark in-test loop |
| `routes.ts` | Route entry types + the route table, plus the `coveredPageFiles` and `scanTargets` views derived from it |
| `report.ts` | Scan record accumulator; Phase 5 adds artifact file output |

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
Renaming one silently stops its suppressions from matching — update both maps in
the same change.

## Vendor widgets

Molstar, CodeMirror, and visx SVG internals are excluded via `vendorExclusions` in
`axe-scan.ts`. The wrapping element (e.g. `[data-molstar-viewer]`) must still carry
an accessible name — tested separately in `deep-tier.spec.ts`.

## CI

`pnpm-a11y.yml` runs four parallel jobs (one per spec file). All jobs block merging
to `main` on failure. Report artifacts are uploaded per job (14-day retention).
