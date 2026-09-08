# Architecture (deep reference)

On-demand companion to `AGENTS.md`. Read this when you need the full module map; the `AGENTS.md` summary + on-pattern recipes cover most day-to-day work.

**DXKB V2** is a Next.js 16 app (App Router) serving as a Disease X Knowledge Base — a bioinformatics platform for genomics, metagenomics, and viral research.

## App Router structure (`src/app/`)

Route groups `(…)` are organizational and do NOT appear in the URL.

- `/` — Public home page (search, news, statistics)
- `(auth)/` — `sign-in`, `sign-up`, `forgot-password`
- `(footer)/` — static content pages (about, faq, news, privacy-policy, team, etc.)
- `(views)/` — BV-BRC data view pages: `genome`, `taxonomy`, `strain`, `feature`, `epitope`, `experiment`, `serology`, `surveillance`, `protein-structure`, `domains-and-motifs`. The registry supplies route metadata; production views use explicit per-route composition (see **Views & organism landing**)
- `/organisms/(all|bacteria|viruses)/...` — organism landing pages (tabbed; driven by `_config.ts` + view registry)
- `/workspace/...` — workspace file browser. Route shapes: `/workspace/[username]/home/[[...path]]`, `/workspace/[username]/[folder]/[[...path]]`, `/workspace/home/[[...path]]`, `/workspace/shared/[[...path]]`, `/workspace/public/[username]/[...path]`, `/workspace/workshop`
- `/services/(genomics|metagenomics|phylogenomics|protein-tools|utilities|viral-tools)/...` — service submission forms (route groups as categories)
- `/search/` — Global search
- `/jobs/` — Job monitoring
- `/settings/` — user settings
- `/viewer/structure/` — standalone workspace-backed 3D protein structure viewer
- `/api/auth/...` — Custom auth API routes
- `/api/services/...` — Proxied service API routes
- `/api/workspace/...` — Proxied workspace API routes
- `/api/data/[resource]` — validated, rate-limited same-origin gateway to allowlisted BV-BRC Data API resources
- `/api/structure/[...path]` — validated same-origin proxy for BV-BRC-hosted structure files
- `/api/taxon-view/tab-policy` — tab-visibility policy for views (see `docs/taxon-view-tab-visibility.md`)
- `/api/e2e-mock/[...path]` — loopback backend mock used only by the Playwright suite

## Auth system (`src/lib/auth/`) — server-first identity

- `client.ts` — concrete browser functions for retained `/api/auth/*` mutations and profile operations
- `provider.tsx` — `<AuthBoundary user={user}>`, `useAuth()` derived identity, `useAuthActions()` mutations, and the minimal client route guard
- `routes.ts` — protected page classification used by the proxy and client guard
- `types.ts` — browser-safe `AuthUser`, upstream `UserProfile`, credentials, sessions, and `Result` types
- `server/actions.ts` — named auth operations such as `signIn`, `signOut`, `startImpersonation`, and cached `getCurrentUser`
- `server/session.ts` — sole owner of HttpOnly session and SU backup cookie reads/writes
- `server/cookies.ts` — Edge-safe cookie names and optimistic cookie-presence check
- `server/route.ts` — authenticated route wrapping and direct session reads for routes and Server Components
- `server/adapters/bvbrc-identity.ts` — named BV-BRC identity protocol calls

Notes:

- This is custom BV-BRC authentication, not Better Auth. Server rendering validates cookies through `getCurrentUser()` and passes the browser-safe user into `<AuthBoundary>`; the browser does not fetch a session on mount and never receives the BV-BRC token.
- `src/proxy.ts` delegates page classification to `isProtectedPagePath()`. It optimistically checks cookie presence; Server Components and protected API handlers perform authoritative validation.
- The active session cookies are `bvbrc_token`, `bvbrc_user_id`, and optional `bvbrc_realm`, all HttpOnly, SameSite Strict, path `/`, and Secure in production. Explicit sign-out is a redirecting Server Action, not an `/api/auth/sign-out` route.
- `/api/auth/*` wire contracts are documented in `docs/auth-api.md`. Every auth failure uses `{error, code}`.

## Backend communication

- `JsonRpcClient` (`src/lib/jsonrpc-client.ts`) — all backend calls use JSON-RPC 2.0 over HTTP POST; requires `APP_SERVICE_URL` env var
- `AppService` (`src/lib/app-service.ts`) — job management: enumerate/query/kill jobs, submit services via `AppService.start_app2`
- `WorkspaceApiClient` (`src/lib/services/workspace/client.ts`) — workspace CRUD operations
- `src/lib/data-api/` — typed Data API resource registry, validation, RQL serialization, server/browser repositories, normalized response types, and TanStack Query option/key factories. Browser view code uses `/api/data/[resource]`; upstream URLs and BV-BRC tokens remain server-only.

### Data API gateway contract

- Supported resources: `genome`, `genome_feature`, `epitope`, `epitope_assay`, `surveillance`, `serology`, `strain`, `protein_feature`, `protein_structure`, `experiment`, `bioset`, `genome_sequence`, and `ppi`.
- Stable IDs, in the same order: `genome_id`, `feature_id`, `epitope_id`, `assay_id`, `id`, `id`, `id`, `id`, `pdb_id`, `exp_id`, `bioset_id`, `sequence_id`, and `id`. `genome_feature` also accepts `patric_id`; Surveillance and Serology allow their documented compound public identifiers. Identifiers remain strings even when digit-only.
- Resource metadata allowlists field type, selection, sorting, faceting, and RQL quoting. Requests are bounded and validated by resource, operation, identifier, field, operator, range/export size, URL/body size, and rate limit. Sorts gain the stable ID as a deterministic tie-break.
- Upstream item ranges use an exclusive end: `items=0-200` yields 200 rows. Collection pages are one-based and fixed at 200 rows.
- Anonymous public member lookups use five-minute shared caching (`s-maxage=300`). Authenticated/private requests, collections, selected-row requests, and exports use `no-store`.

## Workspace browser (`src/components/workspace/`)

- `workspace-shell.tsx` — top-level orchestrator mounted by the workspace route pages
- `workspace-browser.tsx` — combines file listing, sorting, breadcrumbs, toolbar, dialogs, resizable panels
- `workspace-file-table.tsx` — TanStack Table-based file listing with virtual scrolling
- Details panel uses `react-resizable-panels` with state in `WorkspacePanelContext`
- Favorites stored in `favorites.json` workspace file (see `src/lib/services/workspace/favorites.ts`)
- **Repository pattern**: workspace data access goes through `WorkspaceRepositorySet` (`src/lib/services/workspace/workspace-repository.ts`), provided via `WorkspaceRepositoryProvider`, consumed with `useWorkspaceRepository()`. Prefer this over calling the client directly. Path helpers in `path-utils.ts`; RQ keys in `workspace-query-keys.ts`.

## Views & organism landing

`src/lib/views/`, `src/components/views/`, `src/hooks/views/`, `src/components/organisms/`, `src/app/(views)`, `src/app/organisms/`

- `src/lib/views/view-registry.ts` — enumerable, data-only route metadata for canonical segments, legacy redirects, search mapping, identifiers, resources, and defaults. Do not put components, fetch functions, columns, or tab query builders in it.
- `src/lib/views/collection-state.ts` — canonical URL-owned collection state. Pages are one-based, sort uses `field:asc|desc`, page 1/default sort are omitted, and filtering changes reset page 1. Page size (200), row selection, and column layout remain outside the URL.
- `src/components/views/` — generic `ResourceCollection`, `ResourceWorkspace`, controlled resource filtering, export formatting, and `EntityViewShell` composition. `EntityViewShell` reuses the organism landing navigation and content-frame primitives so resource views retain the Taxonomy layout across desktop and mobile. Profile-backed Genome, Feature, Epitope, Surveillance, Serology, Strain, Domains and Motifs, Protein Structures, and Experiment adapters support canonical collections and scoped member tabs; Taxonomy contributes immutable lineage scope for those collection tabs, while Feature retains cross-core queries where required. Surveillance and Serology keep backend `id` as row identity and resolve public members by `sample_identifier` plus their optional discriminator (`pathogen_test_type` or `test_type`), presenting a choice when the sample alone is ambiguous. Strain and Domains and Motifs are list-only and use backend `id`; their selected-record details stay in the collection. `src/hooks/views/` owns TanStack Query collection/detail behavior, URL synchronization, and local explicit/all-matching selection state.
- Genome routes are implemented: `/genome` is the focused `genome` collection, and `/genome/[genomeId]` is the `genome_id` member. Features, Proteins, and Domains and Motifs use exact `genome_id` scopes; later-phase tabs remain capability-gated when their data/component contract is unavailable.
- Feature routes are implemented: `/feature` is the focused `genome_feature` collection, and `/feature/[featureId]` uses canonical `feature_id`. Legacy `fig|...` PATRIC IDs resolve through `patric_id` and permanently redirect to the canonical member. Overview, exact-feature Interactions, and exact-feature Domains and Motifs are available; unsupported tabs remain capability-gated.
- Epitope routes are implemented: `/epitope` is the focused `epitope` collection, and `/epitope/[epitopeId]` provides Overview and an exact-epitope `epitope_assay` collection. The Taxonomy Epitope tab uses the same collection profile with immutable lineage scope.
- Surveillance and Serology routes are implemented as focused collections plus compound sample members. Their Taxonomy tabs reuse the same profiles with immutable lineage scope; public member identity remains separate from backend row identity.
- Strain is implemented as a focused list-only `/strain` collection. It has no member route; selection-driven details stay in the collection, and the Taxonomy Strains tab reuses the same profile with immutable lineage scope and local loaded-row keyword filtering.
- Domains and Motifs is implemented as a focused list-only `/domains-and-motifs` collection backed by `protein_feature`. Its Taxonomy tab uses the same profile with a cross-core Genome lineage scope and intentionally does not exclude Deprecated genomes; Genome and Feature member tabs use exact parent scopes.
- Protein Structures is implemented as a profile-backed `/protein-structure` collection and an id-less member selected by `?accession=` or `?path=`. Accession mode accepts up to 10 PDB or AlphaFold accessions and enriches PDB entries from `protein_structure` when metadata is available; workspace mode accepts one mutually exclusive workspace path. Mol* tries ordered sources until one loads: a BV-BRC `file_path` through `/api/structure/[...path]`, then an AlphaFold model inferred from the accession or UniProt metadata, then RCSB for PDB IDs. Workspace files load through `/api/workspace/view/...`. The same collection profile powers exact Genome scopes, Feature matches across PATRIC ID/sequence MD5/UniProt/PDB identifiers, and Taxonomy's non-Deprecated lineage join.
- Experiment routes are implemented: `/experiment` provides Experiments and Biosets tabs; the Biosets tab resolves the matching Experiment IDs first so Experiment filters and keyword searches scope its `bioset` collection. `/experiment/[experimentId]` preserves the positive digit-string `exp_id` and provides Overview and an exact-experiment `bioset` collection. Biosets have no top-level route. Genome and Taxonomy Experiment tabs reuse the profile with immutable exact or lineage scope.
- Residual scaffold helpers remain only for routes not yet migrated to a production collection. Domain schemas, profiles, query builders, columns, and tabs stay with the route rather than entering a universal singular-view dispatcher.
- Organism landing pages (`src/app/organisms/(all|bacteria|viruses)`) are tabbed, driven by a per-organism `_config.ts` (`OrganismLandingConfig` in `src/components/organisms/types.ts`) + shared components in `src/components/organisms/`.
- URL schema (view types → URL params, legacy hash redirects) documented in `docs/url-schema/`. Legacy `#`-URL support: `legacy-hash-adapter.tsx` / `legacy-redirect.ts`.
- Tab visibility policy: `src/app/api/taxon-view/tab-policy` + `docs/taxon-view-tab-visibility.md`.
- Phylogeny renderers, local Nextstrain datasets, deployment, and licensing: `docs/phylogeny-integration.md`.

## Services pattern

- Each bioinformatics service is a form page under `/services/`
- Forms use TanStack Form (`@tanstack/react-form`) + zod validation
- Submission: `useServiceFormSubmission` hook → `submitServiceJob()` → `AppService.start_app2`
- `ServiceDebuggingProvider` wraps service layouts; enables a debug mode that shows params instead of submitting

## Rerun pre-fill pattern

- `useRerunForm<T>()` reads job params from `sessionStorage` (keyed by `?rerun_key=`) and returns `{ rerunData }`
- Pre-fill is auto-applied via the hook's declarative options (`fields`, `libraries`, `syncLibraries`, `onApply`); the hook self-manages one-shot application internally
- The sessionStorage entry is intentionally NOT consumed on read because React rendering may remount the form; consume-on-read could null out a subsequent mount
- Library reconstruction helpers in `src/lib/rerun-utility.ts`:
  - `buildPairedLibraries(rerunData, getExtra?)` — paired-end libs from `paired_end_libs`
  - `buildSingleLibraries(rerunData, getExtra?)` — single-end libs from `single_end_libs`
  - `buildSraLibraries(rerunData)` — SRA libs from `srr_libs` with `srr_ids` fallback
  - Pass a `getExtra` callback to merge service-specific fields (e.g. `platform`, `interleaved`)

## Data fetching

- TanStack Query for all async state (client-side)
- View collections and member detail panels use `src/hooks/views/` over the `DataRepository` boundary in `src/lib/data-api/`; components do not parse upstream wire formats.
- Custom hooks in `src/hooks/services/workspace/` wrap workspace API calls
- `src/lib/api/client.ts` uses credentialed fetch; only the app-specific `session_expired` code triggers one hard reload, while ordinary upstream 401 responses remain API errors

## UI

- shadcn/ui (New York style, slate base) in `src/components/ui/`, built on `@base-ui` primitives (e.g. https://ui.shadcn.com/docs/components/base/accordion)
- Tailwind CSS v4 with CSS variable theming; multiple named themes in `src/app/globals.css`
- SVG via `@svgr/webpack` (`import Icon from './file.svg'` or `'./file.svg?url'` for raw URL)
- `sonner` for toasts; `lucide-react` for icons

## Key type files

- `src/types/workspace.ts` — Job/RPC types
- `src/types/workspace-browser.ts` — `WorkspaceBrowserItem`, `SortField`, etc.
- `src/types/services.ts`, `src/types/filters.ts` — service form + filter types
- `src/lib/auth/types.ts` — `AuthUser`, `UserProfile`, credential types
- `src/lib/views/view-types.ts`, `src/components/organisms/types.ts` — view + organism landing config types
