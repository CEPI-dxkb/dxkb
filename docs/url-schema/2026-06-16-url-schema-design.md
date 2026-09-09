# URL Schema Expansion for All View Types — Design

**Date:** 2026-06-16
**Status:** Approved; amended 2026-09-02 through completed Protein Structures Phase 8
**Scope:** URL schema contract, routing skeleton, and production collection/member conventions

---

## 1. Goal

Define and scaffold a single, consistent URL schema for all DXKB view types, replacing
the legacy BV-BRC `/view/{ViewType}/...` hash-based scheme. This document is the routing
contract every later view-implementation effort builds against.

The legacy reference (what we are migrating _from_) is documented in
`docs/url-schema/bvbrc-view-types-url-parameters.md`.

### Deliverable

**Schema + routing skeleton.** We build:

- the URL contract for all view types,
- a data-driven view registry,
- the Next.js route folders and thin page handlers,
- shared render shells,
- redirects (internal param rename + legacy `/view/*`).

We do **not** build the real per-type data fetching or grids/tabs UI in this effort
(see §8 Out of Scope).

---

## 2. The URL Contract

### 2.1 General shape

```
dxkb.org/{segment}[/{entityId}]?tab={tab}&{filters}
```

- **`{segment}`** — the view type, lowercase kebab-case. This is the route folder and the
  URL identity of the type.
- **Bare segment** (`/genome`) = **List view** (search/browse results).
- **Segment + id** (`/genome/59201.7581`) = **Singular view** (one record).
- **`?tab=`** — the active tab (the items in `landing-nav.tsx`). Applies to _both_ list and
  singular views. The default tab is omitted from the URL.
- **`{filters}`** — list-view query params (friendly named params and/or `?rql=`).

### 2.2 Decision: List = index of segment (combined, not separate)

The 20 legacy view types (`Genome` + `GenomeList`, etc.) collapse to **10 segments**. The
bare segment is the list; segment + id is the singular. This is REST-idiomatic
(collection `/genome`, member `/genome/{id}`) and halves the number of route folders and
the cost of cross-cutting per-type features (see §3).

Rejected alternative — keeping `Genome` and `GenomeList` as separate segments — was
evaluated and offers no real benefit for the 6 well-behaved types: the index page and the
`[id]` page are already separate, independently-typed files, so the "distinct metadata /
type-safety" arguments for separation are already satisfied by the combined layout. The
only edge for separation was naming honesty on the 2 list-only types, which we handle
explicitly with `notFound()` instead (see §2.4).

### 2.3 Decision: tab param is `?tab=` (query, not hash)

- The codebase already differentiates tabs with a **query param** (currently `?view=` in
  `landing-shell-client.tsx`). We rename it to `?tab=` for semantic clarity ("tab" = the
  thing in `landing-nav`, distinct from "view type" = the segment).
- It stays a **query param**, not a hash, because the active tab is read **server-side** in
  the RSC page (`taxonomy/[taxonId]/page.tsx` reads `searchParams`) to server-render the
  correct tab. A hash is client-only and would break SSR and per-tab SEO indexing.
- The day-old `?view=` links are redirected to `?tab=` (see §6.1).

### 2.4 The 10 segments

| segment              | singular route                   | list route            | entity id                                | id kind | legacy singular / list                        |
| -------------------- | -------------------------------- | --------------------- | ---------------------------------------- | ------- | --------------------------------------------- |
| `taxonomy`           | `/taxonomy/{taxonId}`            | `/taxonomy`           | NCBI taxon id                            | int     | Taxonomy / TaxonList                          |
| `genome`             | `/genome/{genomeId}`             | `/genome`             | BV-BRC genome id (`59201.7581`)          | string  | Genome / GenomeList                           |
| `feature`            | `/feature/{featureId}`           | `/feature`            | PATRIC feature id                        | string  | Feature, Protein / FeatureList, ProteinList   |
| `epitope`            | `/epitope/{epitopeId}`           | `/epitope`            | epitope id                               | string  | Epitope / EpitopeList                         |
| `surveillance`       | `/surveillance/{sampleId}`       | `/surveillance`       | sample identifier                        | string  | Surveillance / SurveillanceList               |
| `serology`           | `/serology/{sampleId}`           | `/serology`           | sample identifier                        | string  | Serology / SerologyList                       |
| `strain`             | — (none)                         | `/strain`             | —                                        | —       | — / StrainList                                |
| `domains-and-motifs` | — (none)                         | `/domains-and-motifs` | —                                        | —       | — / DomainsAndMotifsList, ProteinFeaturesList |
| `protein-structure`  | `/protein-structure?accession=…` | `/protein-structure`  | accession or workspace path (no path id) | none    | ProteinStructure / ProteinStructureList       |
| `experiment`         | `/experiment/{experimentId}`     | `/experiment`         | experiment id                            | int     | ExperimentComparison / ExperimentList         |

\* Legacy singular uses `ExperimentComparison` as the URL segment (not `Experiment`). The bare `Experiment` viewer is workspace-only with no public URL. Both singular and list routes are scaffolded.

### 2.5 Tab defaults differ between list and singular

Both list and singular accept `?tab=`, but their default (omitted) tab differs and is held
per-type in the registry. From the legacy doc:

- **Singular default:** `overview` (where a singular exists).
- **List defaults:** `taxonomy`→`taxons`, `genome`→`genomes`, `feature`→`overview`,
  `epitope`→`epitope`, `surveillance`→`surveillance`, `serology`→`serology`,
  `strain`→`strain`, `domains-and-motifs`→`proteinFeatures`,
  `protein-structure`→`structures`, `experiment`→`experiments`.

### 2.6 Oddball handling (explicit)

- **List-only types** (`strain`, `domains-and-motifs`): no `[id]` folder exists; any
  attempt to reach a singular returns `notFound()`.
- **`protein-structure`**: no path id. The singular form is `?accession=6VXX` (comma-
  separated for up to 10 PDB or AlphaFold accessions: `6VXX,7BZ5`) or
  `?path=/user@bvbrc/home/x.pdb` (one workspace file, mutually exclusive with
  `accession`). One explicit `page.tsx` handles both the profile-backed collection and
  query-identified member.
- **`experiment`**: has both list and singular routes. Legacy singular URL segment is `ExperimentComparison` (not `Experiment`); map `legacySingular: "ExperimentComparison"` in the registry. The bare `Experiment` viewer is workspace-only and has no public URL.

### 2.7 Examples

```
dxkb.org/taxonomy/234                                                  # taxonomy singular, default tab (overview)
dxkb.org/taxonomy/234?tab=genomes                                      # taxonomy singular, genomes tab
dxkb.org/genome/59201.7581?tab=features                                # genome singular, features tab
dxkb.org/feature/PATRIC.83332.707.NC_000962.CDS.1.1524.fwd            # feature singular, default tab (overview); dotted PATRIC id in path
dxkb.org/surveillance/ISDN123456?pathogen_test_type=Influenza%20A      # surveillance singular; named query param carried verbatim
dxkb.org/experiment/2000000                                            # experiment singular (legacy: ExperimentComparison), default tab
dxkb.org/genome?keyword=influenza                                      # genome LIST, debounced token-prefix search → keyword(influenza*)
dxkb.org/genome?taxon_id=1763                                          # genome LIST, friendly filter → eq(taxon_lineage_ids,1763)
dxkb.org/genome?genome_status=Complete&genome_status=WGS               # repeated facet values → or(eq(genome_status,Complete),eq(genome_status,WGS))
dxkb.org/genome?rql=and(eq(taxon_lineage_ids,1763),gt(genomes,0))      # genome LIST, raw RQL escape hatch
dxkb.org/protein-structure?accession=6VXX,7BZ5                        # protein-structure id-less singular; comma-separated PDB accessions
dxkb.org/protein-structure?path=/user@bvbrc/home/mystructure.pdb       # protein-structure id-less singular; workspace file path
dxkb.org/strain?keyword=H1N1                                           # strain LIST (list-only type — no singular route)
```

### 2.8 Collection position and local state

- Collection position uses one-based `?page=` and `?sort=field:asc|desc`.
- Page 1 and the resource's default sort are omitted from canonical URLs.
- Page size is fixed at 200 and is not URL state.
- Selection and column visibility/order are transient local UI state, not URL state.
- Explicit row selections persist across pages and sorting. They clear when keyword, facets,
  structural scope, or resource changes. "All matching" is symbolic query state and follows the
  same reset rule.
- Keywords are tokenized, prefix-matched, committed after a short debounce, and URL-backed.
- Facets are URL-backed and multi-value. Repeated values for one field are ORed; separate fields
  are ANDed. Facet counts remain constrained by the active query, including that facet's values.
- Changing keyword, structural filters, facets, or sort resets the page to 1. URL updates
  preserve unrelated parameters. Collection parameters are unprefixed; changing resource tabs
  removes parameters invalid for the destination resource.

---

## 3. Architecture: Data-Driven View Registry (Approach "C")

A single enumerable source of truth describing every view type. This is the chosen
approach because the things that **grow** in this codebase are not the number of types
(bounded at ~10), but **cross-cutting features that must be applied to every type**
(redirects, search targets, sitemap, JSON-LD, middleware validation). With a registry each
such feature is an O(1) loop over one table; without it, each is O(types) hand-edits with a
standing risk that a new type is silently forgotten.

Two such cross-cutting features are already in scope (legacy redirect table, search-target
map), so the registry is justified now, not speculative.

### 3.1 Registry is data-only (no render dispatch)

The registry holds **metadata**. It does **not** contain a central `switch` that dispatches
rendering across the type shapes. Rendering stays in the per-folder page handlers, which
call shared shells and pass their registry entry. This keeps the registry low-risk and
avoids a speculative discriminated-union dispatcher over the ~5 physical shapes.

### 3.2 Shape

`src/lib/views/view-types.ts`:

```ts
interface ViewTypeEntry {
  segment: string; // "genome" — route folder + URL identity
  label: string; // "Genome"
  legacySingular?: string; // "Genome"      — legacy redirect source (reverse-mapped)
  legacyList?: string; // "GenomeList"   — legacy redirect source
  searchType?: string; // "genome" from constants/searchInfo.ts — for search repoint (deferred)

  singular?: {
    // omitted ⇒ list-only type (strain, domains-and-motifs)
    idParam: string; // "genomeId" — the [genomeId] folder name
    idKind: "int" | "string" | "none"; // validation; "none" ⇒ id-less (protein-structure)
    defaultTab: string; // "overview"
  };

  list: {
    endpoint: string; // BV-BRC data endpoint, e.g. "genome"
    defaultTab: string; // "genomes" | "taxons" | "overview" | ...
    friendlyParams: string[]; // ["keyword","taxon_id"] — translated to RQL
  };
}
```

`src/lib/views/view-registry.ts`:

```ts
export const viewRegistry = {
  taxonomy: { … },
  genome:   { … },
  // …10 entries
} satisfies Record<string, ViewTypeEntry>;
```

### 3.3 What enumerability buys

Each is a single loop over `viewRegistry`:

- **Legacy redirect table** (build-now): reverse-map `legacySingular`/`legacyList` → segment.
- **Search-bar repoint** (deferred): `searchType` → `segment` lookup.
- **Future**: `sitemap.xml`, JSON-LD per entity type, middleware URL validation, nav labels.

---

## 4. Query Translation

`src/lib/views/rql.ts` converts list-view query strings into the backend RQL dialect.

- **Friendly named params** → typed RQL: `?taxon_id=1763` maps to the resource's lineage
  field; `?keyword=influenza` becomes `keyword(influenza*)`. Multiple keyword tokens are
  ANDed.
- **Multi-value facets** use repeated parameters. Values for one field are ORed and separate
  fields are ANDed.
- **Raw escape hatch**: `?rql=` is accepted after validation/sanitization.
- **Precedence**: an explicit `?rql=` wins over friendly structural facets; keyword remains
  independently combinable with either form.
- **Named special params** (carried verbatim/mapped per legacy doc): `pathogen_test_type`
  (surveillance), `test_type` (serology), `accession`/`path` (protein-structure),
  `filter` (feature list grid default).

### 4.1 Shared Data API contract

Production views use `src/lib/data-api/` through the same-origin
`/api/data/[resource]` gateway. Supported resources are `genome`, `genome_feature`,
`epitope`, `epitope_assay`, `surveillance`, `serology`, `strain`, `protein_feature`,
`protein_structure`, `experiment`, `bioset`, `genome_sequence`, and `ppi`.

The resource registry owns each stable ID and any permitted alternate member identifiers:
`genome_id`, `feature_id` (alternate `patric_id`), `epitope_id`, `assay_id`, `id`, `id`,
`id`, `id`, `pdb_id`, `exp_id`, `bioset_id`, `sequence_id`, and `id`, respectively.
Surveillance additionally permits `sample_identifier` and multivalued
`pathogen_test_type`; Serology permits `sample_identifier` and scalar `test_type` for
compound member lookup. An `eq()` clause is a backend match predicate and does not imply
scalar cardinality. Public identifiers remain strings even when digit-only.

Each registered field declares its type, allowed RQL operators, and whether it may be
selected, sorted, or faceted, plus its RQL quoting policy. String and boolean fields allow
`eq`, `ne`, and `in`; number and date fields additionally allow `lt`, `le`, `gt`, and `ge`.
The gateway rejects unknown resources, identifiers, fields, field/operator combinations,
sorts, facets, operations, and unbounded requests before contacting the upstream service.
It normalizes collection, member, selected-row, and bounded-export results; collection sorts
append the stable ID as a deterministic tie-break. Exports are limited to 10,000 total rows,
and backend projections always include the resource ID required for response validation.

Upstream item ranges have an exclusive end: `items=0-200` yields 200 rows. Thus page `p`
uses `start = (p - 1) * 200` and `end = start + 200`. Anonymous public member responses may
be shared for five minutes (`s-maxage=300`); authenticated/private responses, collections,
selected rows, and exports are `no-store`. The gateway preserves client-safe upstream
`401`, `403`, `404`, and `429` statuses and maps other upstream failures to `502` while
retaining a concise meaningful message.

---

## 5. File Layout & Render Shells

### 5.1 New files

```
src/lib/views/
  view-types.ts            # ViewTypeEntry and shared types
  view-registry.ts         # the 10-entry table
  rql.ts                   # friendly-params + ?rql= → RQL
  render-list.tsx          # renderListShell(entry, searchParams)
  render-singular.tsx      # renderSingularShell(entry, id, searchParams)
  __tests__/

src/app/(views)/
  layout.tsx               # EXISTS — add <LegacyHashAdapter/> (see §6.2)
  taxonomy/
    page.tsx               # ADD — list
    [taxonId]/page.tsx     # EXISTS — migrate ?view= → ?tab=, route via registry
  genome/
    page.tsx               # list
    [genomeId]/page.tsx    # singular
  feature/
    page.tsx
    [featureId]/page.tsx
  epitope/
    page.tsx
    [epitopeId]/page.tsx
  surveillance/
    page.tsx
    [sampleId]/page.tsx
  serology/
    page.tsx
    [sampleId]/page.tsx
  strain/
    page.tsx               # list only — NO [id]
  domains-and-motifs/
    page.tsx               # list only — NO [id]
  protein-structure/
    page.tsx               # handles list AND id-less singular (?accession/?path)
  experiment/
    page.tsx               # list
    [experimentId]/page.tsx  # singular (legacy: ExperimentComparison)
```

### 5.2 Thin page handlers delegate to shells

```tsx
// genome/page.tsx  (LIST)
export const dynamic = "force-dynamic";
export default async function GenomeListPage({ searchParams }) {
  return renderListShell(viewRegistry.genome, await searchParams);
}

// genome/[genomeId]/page.tsx  (SINGULAR)
export const dynamic = "force-dynamic";
export default async function GenomePage({ params, searchParams }) {
  const { genomeId } = await params;
  return renderSingularShell(viewRegistry.genome, genomeId, await searchParams);
}
```

Pages stay explicit and readable (open one file, see what the route does); the repeated
parse/validate/resolve logic lives once in the shells.

### 5.3 `renderSingularShell` (generalizes today's taxonomy page)

1. If the entry has no `singular` (list-only type) → `notFound()`.
2. Validate the id per `idKind` (`int` → integer > 0; `string` → non-empty; `none` →
   n/a) → invalid → `notFound()`.
3. Fetch the entity (per-type fetch function; only `taxonomy` is real in this effort,
   others are placeholders).
4. Resolve active tab: `?tab=` if valid for the type, else `singular.defaultTab`.
5. Render the existing `OrganismLandingShell` (unchanged component).

### 5.4 `renderListShell`

1. Translate the query (friendly params + `?rql=`) via `rql.ts`.
2. Resolve active tab: `?tab=` if valid, else `list.defaultTab`.
3. Render a list shell — a **placeholder grid** in this effort.

### 5.5 Oddball pages

- `protein-structure/page.tsx` — branches on `?accession=` / `?path=` (id-less singular)
  vs no params (list). Own body; calls shells as appropriate.
- `strain`, `domains-and-motifs` — list `page.tsx` only, no `[id]` folder.

### 5.6 Production views after the scaffold

The registry remains enumerable, data-only route metadata, but the scaffold factories are
not the production architecture for every route. Implemented views own explicit route
composition under `src/app/(views)/<segment>/`, use shared collection/entity mechanics from
`src/components/views/` and `src/hooks/views/`, and keep domain schemas, queries, columns,
and tabs close to the route.

Genome Phase 1 replaces both scaffold handlers with explicit routes:

- `/genome` is a Genome collection backed by the `genome` resource. It supports
  `keyword`, `taxon_id` (mapped to `taxon_lineage_ids`), `rql`, `page`, and validated `sort`.
  For explicit Genome RQL selections it also exposes the legacy GenomeList tab set, with
  supported related-resource tabs scoped through the selected Genome query and unsupported
  tabs capability-gated.
- `/genome/{genomeId}` validates and fetches the exact `genome_id`, renders the member
  overview, and owns explicit member-tab composition.
- Genome member tabs are Overview, Genome Browser, Sequences, Features, Proteins, Protein
  Structures, Domains and Motifs, Experiments, and Interactions. Tabs ship only when backed
  by a current component and exact `genome_id` query contract; unavailable dependency-phase
  tabs are capability-gated rather than rendered as placeholders. The default Overview tab
  is omitted from the URL.

Protein Structures Phase 8 replaces its historical scaffold body with explicit dual-mode
composition:

- Bare `/protein-structure` renders the shared `protein_structure` collection profile with
  URL-owned keyword, facet, page, sort, and RQL state. Rows link to the accession member.
- `?accession=` renders one or more query-identified structures. PDB accessions receive
  optional BV-BRC metadata lookup; missing metadata does not prevent public-source viewing.
  `?path=` renders one workspace structure through the workspace proxy.
- Mol* consumes an ordered source list and advances after load failure: BV-BRC `file_path`
  through `/api/structure/[...path]`, AlphaFold from an AlphaFold/UniProt accession, then
  RCSB for PDB IDs. The BV-BRC proxy validates path segments and preserves upstream errors.
- Genome members embed the profile with exact `genome_id` scope. Feature members match
  available PATRIC ID, sequence MD5, UniProt, and PDB identifiers. Taxonomy embeds it through
  the Genome lineage join while excluding Deprecated genomes.

---

## 6. Redirects (build-now)

Two redirect jobs, split by where the source data lives.

### 6.1 Internal `?view=` → `?tab=`

Both are server-readable query params → handled by a clean `308` in middleware.

- `/taxonomy/234?view=genomes` → `/taxonomy/234?tab=genomes`.
- Plus a code rename of `view` → `tab` across the day-old files (see §9).

### 6.2 Legacy BV-BRC `/view/*` → new schema (two-stage)

The legacy tab lives in the **hash** (`#view_tab=features`), which the server cannot read.
So the redirect is two stages:

**Stage 1 — server (path + query), middleware:**

- `/view/Genome/59201.7581` → `/genome/59201.7581`
- `/view/GenomeList/?eq(taxon_id,1763)` → `/genome?rql=eq(taxon_id,1763)`
- Legacy name → segment via the registry reverse-map (`legacySingular`/`legacyList`).
- Named query params (`pathogen_test_type`, `test_type`, `accession`, `path`, `filter`)
  carried/mapped per the legacy doc.
- Emits a `308`; the browser **auto-preserves the `#hash`** across the redirect.

**Stage 2 — client (hash → `?tab=`):**

- A small `LegacyHashAdapter` client component mounted in `(views)/layout.tsx` reads any
  leftover `#view_tab=x` (and `#filter=`, `#accession=`) after mount and rewrites it to the
  equivalent query param via `history.replaceState` (no reload).

**Middleware matcher:** add `/view/:path*` (and the `(views)` paths for §6.1) to the
`proxy.ts` `config.matcher`, which is currently auth-only.

**Coverage:** the full 20-legacy-name → 10-segment table is derived from the registry so it
cannot drift from the routes.

---

## 7. Testing

Vitest (coverage floors enforced — new pure modules raise the numbers):

- **`rql.ts`** — friendly→RQL, `?rql=` precedence, multi-param `and()`, sanitization, edge
  cases. Pure, high-value.
- **registry** — every entry is structurally valid; legacy names are unique; the reverse-map
  is total (no legacy name maps to a missing segment).
- **redirect logic** — `view`→`tab`; legacy path/query mapping; hash-stage transform.
- **`render-singular`** — id validation per `idKind`; list-only → `notFound()`; tab
  resolution.
- **taxonomy migration** — update existing tests from `view` to `tab`.
- **E2E (Playwright)** — none added in this effort (views are placeholders). Add with the
  data phase. Noted in `/e2e`.

---

## 8. Out of Scope — and how to pick each up next

Each item below is **intentionally deferred**. The schema/skeleton makes each a contained
follow-up. Guidance for the next engineer:

### 8.1 Real list data-fetch + grids (per type; historical deferral)

- **Why deferred:** each type has its own endpoint, columns, filters, and pagination — this
  is the bulk of the work and is naturally one sub-project per type.
- **Next steps:** for each segment, add a per-type fetch function (mirror
  `src/lib/services/organisms/taxonomy.ts`) and a real list component to replace the
  placeholder grid in `renderListShell`. Use the existing TanStack Table virtualized
  pattern (`workspace-data-table.tsx`, `shared/data-table.tsx`) and add `"use no memo"` per
  the React Compiler rules in `AGENTS.md`. Wire columns from the registry endpoint. Start
  with `genome` (highest traffic) as the template, then replicate.
- **Dependency:** none on other deferred items; can begin immediately after the skeleton.
- **Current status:** completed for implemented production profiles, including Protein
  Structures in Phase 8. This subsection records the original scaffold boundary.

### 8.2 Real singular data-fetch for the 9 non-taxonomy types (historical deferral)

- **Why deferred:** only `taxonomy` has a real fetch + overview today; the other singulars
  render placeholders via `OrganismLandingShell`.
- **Next steps:** implement a fetch fn + a real overview/tab components per type; register
  the fetch fn so `renderSingularShell` calls it. The shell, id validation, and tab
  resolution are already done — this is "fill in the fetch + the tab bodies." Reuse the
  taxonomy route's `_config.ts` / `views/` colocated pattern.
- **Dependency:** `protein-structure` singular needs the 3D viewer already at
  `src/app/viewer/structure/` — reuse it rather than rebuilding.
- **Current status:** Protein Structures Phase 8 is complete and shares the Mol* source
  viewer with workspace and standalone structure viewing. Other types may retain their own
  implementation status; this subsection records the original scaffold boundary.

### 8.3 Search-bar / command-palette repoint → List views

- **Why deferred:** the search UX is the motivating use case but depends on the List views
  rendering real results (8.1). Repointing to placeholder lists would look broken.
- **Next steps:** in `search-bar.tsx` / `command-palette.tsx`, replace the
  `/search?q=…&searchtype=…` push with a push to `/{segment}?keyword=…`, mapping the
  selected `searchtype` → `segment` via the registry `searchType` field (already populated).
  Decide the fate of the catch-all `/search` page (keep as "everything" aggregator, or
  retire). Update the related Vitest specs in `src/components/search/__tests__/`.
- **Dependency:** 8.1 (lists must render real data first).

### 8.4 Sitemap, JSON-LD, SSG/ISR per type

- **Why deferred:** SEO/performance optimization, not needed for the skeleton.
- **Next steps:** add `app/sitemap.ts` that loops the registry; add `generateMetadata` +
  JSON-LD per singular route keyed off the registry entity type; evaluate
  `generateStaticParams` + `revalidate` (ISR) for high-cardinality singulars (genome,
  feature). All are registry loops — the enumerable table is the payoff here.
- **Dependency:** 8.1 / 8.2 (need real data to describe).

---

## 9. Migration Touch-List (day-old `?view=` code)

These shipped files (commits from 2026-06-15) must be updated for the `view` → `tab` rename:

- `src/components/organisms/landing-shell/landing-shell-client.tsx` (param read/write)
- `src/app/(views)/taxonomy/[taxonId]/page.tsx` (searchParams `view` → `tab`)
- `src/app/organisms/all/page.tsx`
- `src/app/organisms/bacteria/page.tsx`, `src/app/organisms/viruses/page.tsx`
- their `__tests__` specs

---

## 10. Risks & Problems

| #   | Risk / problem                                                                                                            | Likelihood                    | Impact                                  | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Genome/feature ids contain dots/special chars** (`59201.7581`, PATRIC ids).                                             | High (normal data)            | Routing breakage                        | Next dynamic `[genomeId]` segments accept dots; explicitly unit/E2E test a dotted id and a PATRIC id end-to-end.                                                                                                                                                                                                                                                                                                                                                                      |
| R2  | **Middleware `/view/*` matcher over-matches** or collides with the auth matcher.                                          | Medium                        | Wrong redirects / auth regressions      | Scope the matcher precisely; unit-test that non-`/view` and auth paths are untouched; verify the existing auth redirects still fire.                                                                                                                                                                                                                                                                                                                                                  |
| R3  | **Hash → `?tab=` Stage-2 flash.** Deep-linked legacy hash links briefly render the default tab before the client rewrite. | Medium                        | Minor visual flash on legacy links only | Use `history.replaceState` (no reload); accept minor flash; document. New `?tab=` links are unaffected (server-rendered).                                                                                                                                                                                                                                                                                                                                                             |
| R4  | **Legacy name → segment reverse-map is incomplete** (a legacy name maps to nothing).                                      | Low                           | 404 on inbound legacy link              | Derive the table from the registry; unit-test totality (every `legacySingular`/`legacyList` resolves).                                                                                                                                                                                                                                                                                                                                                                                |
| R5  | **`?view=` rename breaks day-old links / tests.**                                                                         | High (it will) until migrated | Broken tab nav / red CI                 | Do the rename + the `view`→`tab` redirect together (§6.1); update tests in the same change.                                                                                                                                                                                                                                                                                                                                                                                           |
| R6  | **Coverage floor trips** on the skeleton PR.                                                                              | Low                           | Red CI                                  | New pure `rql.ts` + registry tests _raise_ measured coverage; do not lower floors.                                                                                                                                                                                                                                                                                                                                                                                                    |
| R7  | **React Compiler + `LegacyHashAdapter`** (a client hook-bearing component) gets mis-memoized.                             | Low                           | Subtle client bug                       | Follow `AGENTS.md` rules; add `"use no memo"` if it uses an incompatible hook; let the `react-hooks/incompatible-library` lint be the signal.                                                                                                                                                                                                                                                                                                                                         |
| R8  | **`protein-structure` dual-mode page** (list vs id-less singular) is an inconsistent shape vs the other 9.                | Medium                        | Confusing/edge bugs                     | Keep its own explicit `page.tsx` body (no forced registry dispatch); cover both `?accession=` and `?path=` branches with tests.                                                                                                                                                                                                                                                                                                                                                       |
| R9  | **Premature registry abstraction** if the 10 types diverge more than expected.                                            | Low                           | Rework                                  | Registry is **data-only**; render stays per-page, so divergence is absorbed in page bodies, not the table. The table only holds genuinely shared metadata.                                                                                                                                                                                                                                                                                                                            |
| R10 | **`force-dynamic` everywhere** forgoes caching for high-traffic singulars.                                                | Medium (perf, later)          | Slower pages at scale                   | Acceptable for the skeleton; revisit with SSG/ISR in 8.4.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| R11 | **Taxonomy name-as-id** legacy form (`/view/Taxonomy/Brucella`).                                                          | Low                           | A legacy _name_ deep link 404s          | The shipped `taxonomy/[taxonId]/page.tsx` is **int-only** (`notFound()` on non-integers), so `idKind: "int"` matches reality. Stage-1 still rewrites `/view/Taxonomy/Brucella` → `/taxonomy/Brucella`, which then 404s. Name→id resolution is **not** built in this effort; if inbound name links prove common, add a name-resolution branch later (the legacy `TaxonList` name-resolution query is documented in the legacy doc). Numeric ids (the overwhelmingly common form) work. |

---

## 11. Summary of Locked Decisions

| Decision              | Choice                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deliverable           | Schema + routing skeleton for all view types, plus subsequent production phases through Protein Structures Phase 8                                                    |
| List ↔ singular       | Combined: bare segment = list, `+id` = singular → **10 segments**                                                                                                     |
| Segment casing        | lowercase kebab-case                                                                                                                                                  |
| Tab param             | `?tab=` (query, server-readable), migrated from `?view=`                                                                                                              |
| Architecture          | Data-driven view **registry** (data-only, render stays per-page)                                                                                                      |
| List query format     | Friendly named params **+** `?rql=` escape hatch                                                                                                                      |
| Oddballs              | All 10 documented; scaffold the real ones; list-only → `notFound()` on `[id]`; protein-structure id-less; experiment singular uses legacy name `ExperimentComparison` |
| Redirects (build now) | Internal `view`→`tab` + legacy `/view/*` two-stage (server path/query + client hash)                                                                                  |
| Deferred              | Historical scaffold deferrals remain recorded in §8; Protein Structures list/member data and its Genome/Feature/Taxonomy integrations are complete                    |
