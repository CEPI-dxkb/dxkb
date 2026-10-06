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
dxkb.org/genome?keyword=influenza                                      # genome LIST, debounced exact search, as legacy → keyword(influenza)
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
- A view's default filters are omitted too: `/feature` means `annotation=PATRIC`, legacy
  FeatureList's removable default. Removing it writes `annotation=*`, so
  `/feature?annotation=*` lists every annotation and survives reload and sharing. The default
  stays beside an explicit `rql`, as legacy's does beside a link's query
  (`/feature?rql=eq(genome_id,83332.12)` lists that genome's 5,425 PATRIC features, not all
  10,940), unless the rql filters on `annotation` itself (`filtersBesideRql`). That carve-out
  differs from legacy, which ANDs PATRIC onto every query: legacy's
  `FeatureList/?and(eq(genome_id,83332.12),eq(annotation,RefSeq))` lists 0 rows until the
  chip is removed, DXKB's the genome's 5,515 RefSeq features. The Genome list's and Genome
  page's Features tabs (`features.annotation=*`) and the Taxonomy page's Features tab, which
  the organism landing pages (`/organisms/*?tab=features`) share (`annotation=*`), carry the
  same default.
- Page size is fixed at 200 and is not URL state.
- Selection and column visibility/order are transient local UI state, not URL state.
- Explicit row selections persist across pages and sorting. They clear when keyword, facets,
  structural scope, or resource changes. "All matching" is symbolic query state and follows the
  same reset rule.
- Keywords are read by `keywordQuery` (`src/lib/data-api/keyword-terms.ts`) and sent one
  clause per term, committed after a short debounce, and URL-backed.
  - **Terms** are words and quoted phrases (`keywordTerms`). A quoted phrase is one exact
    clause, quotes included (`"DNA polymerase"` sends `keyword("DNA polymerase")`, 17
    genomes, as legacy's search box does), and a quote left open is closed at the end of the
    text, since Solr rejects an unbalanced quote.
  - **Operators** are Solr's, in uppercase only, plus its `||` (OR) and a `-` that starts a
    word or directly precedes a phrase (NOT: `coli -"DNA polymerase"` is 134,273 genomes,
    the phrase excluded). `AND` is the implicit join. `NOT` negates the next term
    (`kinase NOT hypothetical` and `kinase -hypothetical` send
    `and(keyword(kinase),not(keyword(hypothetical)))`, 7 genomes, as Solr reads either in
    one clause). `OR` joins the terms on either side and binds tighter than the implicit AND
    (`E coli OR Salmonella` sends `and(keyword(E),or(keyword(coli),keyword(Salmonella)))`,
    25,228). An operator with nothing to join (`coli OR`, a lone `NOT`) is dropped; as a
    clause of its own it is a Solr SyntaxError. A lowercase `and`, `or` or `not` is a word, as
    in Solr.
  - **Negations** need a positive term beside them: the Data API brackets the keyword
    clauses, and a bracketed group of only NOTs matches nothing
    (`and(eq(genome_id,*),and(not(keyword(coli)),not(keyword(Salmonella))))` is 0 genomes).
    A search of only NOTs therefore adds `keyword(*)` (16,837,798, at no measurable cost), and
    a NOT an `OR` offers is `and(keyword(*),not(...))`.
  - **Divergences from legacy's search-box parser** (`searchToQuery`), where its query
    reads otherwise than it is written: it also ORs every term after an `OR`
    (`kinase OR phosphatase human` as one OR of three; here `human` stays ANDed); it sends a
    NOT inside an OR as `or(not(keyword(coli)),keyword(Salmonella))`, which the Data API
    reads as Lucene does, Salmonella AND NOT coli (61,384 genomes; here not coli, or
    Salmonella: 16,901,125); and its query of only NOTs lists nothing.
  - **Syntax characters** `! ~ ' ( ) [ ] { } : ^ \ & < > = % , + - /` split a word into
    parts, which are ANDed inside the term (`coli OR Salmonella-enterica` sends
    `or(keyword(coli),and(keyword(Salmonella),keyword(enterica)))`, 193,964 genomes, as Solr
    reads it), and a part that is an operator word is quoted. Each is an HTTP 400 in some
    position as written (`keyword(GO:0003677)`; any `!`, `~` or `'`, which the Data API's
    RQL parser refuses however encoded), and Solr's tokenizer splits a word at each of them
    anyway (`keyword(coli-K12)` and `and(keyword(coli),keyword(K12))` are both 1,666 genomes).
    Three readings that work in Solr differ: a boost (`coli^2`, coli's 134,274 genomes, reads
    as coli and 2, 130,072), a range (`<coli`, 129) and a regular expression (`/col/`, 3,382).
    `*` and `?` stay wildcards and `|` inside a word stays (`"fig|83332.12.peg.1"`).
  - **Text without terms** (blank, `"`, `""`, a lone `OR`, only syntax) is no keyword at all,
    so it neither sends a clause nor drops the Genome list's recent default.
  - **Exact and prefix.** Every list route sends each word exact, `keyword(word)`, as legacy
    BV-BRC's lists and the All Data Types counts do: `/feature`, `/genome` and the Genome
    list's related tabs (§4, §5.6), `/taxonomy`, `/strain`, `/domains-and-motifs`,
    `/epitope`, `/protein-structure`, `/surveillance`, `/serology` and `/experiment` (whose
    Biosets tab scopes to the experiments its Experiments tab lists). Nested tables whose
    keyword box searches the server (member-page tabs) and the keyword boxes of `/search`'s
    legacy-type lists add a token prefix, `keyword(word*)`. A prefix is not only wider: Solr
    does not analyze a wildcard term, so a word its tokenizer splits stops matching (Strains
    `H1N1`: 260,889 exact, 76,178 as `H1N1*`; Domains and Motifs `kinase`: 3,283,037 exact,
    3,452,410 as `kinase*`).
  - **Refinements** (`refine`, `rqlKeyword`) are read the same way, exact. Never Solr's
    operators inside one clause: the Data API joins a keyword's text into the surrounding
    query without brackets, so `and(eq(genome_id,*),keyword(coli OR Salmonella))` lists all
    17,033,311 genomes where `or(keyword(coli),keyword(Salmonella))` lists the 195,658 the OR
    matches.
  - **The Data API gateway** (`validateRql`) passes an explicit `rql`'s `keyword(...)` value
    through as written, never adding or removing quotes: unquoted words match in any order
    (`keyword(coli Salmonella)`, 1,933 genomes, like the per-word clauses), and only quotes
    make a phrase or an exact token (`keyword("coli Salmonella")` 29 genomes;
    `keyword("Rv0001")` 1 PATRIC feature against 341,190 unquoted).
  - **The search bar** writes `?keyword=` as legacy's search box (`GlobalSearch.processQuery`)
    reads the typed text: `normalizeLegacyKeyword`, applied by `searchHref` for every
    canonical list and by `/search` to its `q`. It removes `'`, reads `: , + - = < > \ /` as
    spaces, drops quotes that cannot delimit a phrase and closes the phrase left open at the
    end, quotes an ID-like word outside a phrase (`Rv0001` becomes `"Rv0001"`: 1 PATRIC
    feature, where `keyword(Rv0001)` finds 341,190), and writes the `and`/`or`/`not` that
    legacy's parser reads as operators (any case, before another word) in uppercase. It does
    not search text without a letter or digit (`*` alone would list every record), as
    legacy's search box does not. A search therefore lists what alpha's search box lists,
    and the All Data Types counts, built from the same text with exact `keywordClauses`, are
    the totals of the lists they link to, except where a list adds its own default (the
    Features count covers every annotation, the Feature list opens on PATRIC, as alpha's
    do: `Rv0001` counts 4 and lists 1).
  - **A list's own keyword box** sends its text through the same reading, without the
    search bar's normalization: legacy's list boxes send `keyword(word)` per space-separated
    word, so an ID typed there stays a token search (`Rv0001`, 341,190 features) on both.
- Facets are URL-backed and multi-value. Repeated values for one field are ORed; separate fields
  are ANDed. Facet counts remain constrained by the active query, including that facet's values,
  except while a view's default filters are untouched: `/feature` and the Features tabs that
  carry its default then count the annotation facet without it, so it still shows RefSeq
  (§5.6). Beside an explicit `rql`, picking a facet value replaces the rql, except a value of a
  filter the rql keeps, such as the PATRIC default's `annotation`.
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
  ANDed, one clause per word or quoted phrase (`keywordClauses` in `src/lib/data-api/rql.ts`),
  as legacy BV-BRC's search box sends them (`and(keyword(coli),keyword(Salmonella))`;
  `keyword("DNA polymerase")`, never prefixed), with Solr's `OR` and `NOT` as `or(...)` and
  `not(...)` and its syntax characters read as spaces (`keywordQuery`, §2.8). Every list
  route is an exception, for legacy parity: `/feature`, `/genome` (with the keyword clauses
  its related tabs run and those tabs' own keyword boxes), `/taxonomy`
  (`taxonomyCollectionProfile`) and the other seven lists (`serverKeywordMode="exact"`)
  send `keyword(influenza)`, the exact form legacy BV-BRC and the All Data Types search
  send (`coli` matches 134,274 genomes exactly and 137,836 as a prefix; §5.6; §2.8 for the
  words a prefix misses). Nested tables (member-page tabs) and the `/search` legacy-type
  lists' keyword boxes keep the token-prefix search.
- **Multi-value facets** use repeated parameters. Values for one field are ORed and separate
  fields are ANDed.
- **Raw escape hatch**: `?rql=` is accepted after validation/sanitization.
- **Precedence**: an explicit `?rql=` wins over friendly structural facets, except a view's
  default filter on a field the rql does not name (the Feature list's PATRIC default stays);
  keyword remains independently combinable with either form.
- **Named special params** (carried verbatim/mapped per legacy doc): `pathogen_test_type`
  (surveillance), `test_type` (serology), `accession`/`path` (protein-structure),
  `filter` (feature list grid default).

### 4.1 Shared Data API contract

Production views use `src/lib/data-api/` through the same-origin
`/api/data/[resource]` gateway. Supported resources are `taxonomy`, `genome`,
`genome_feature`, `epitope`, `epitope_assay`, `surveillance`, `serology`, `strain`,
`protein_feature`, `protein_structure`, `experiment`, `bioset`, `genome_sequence`,
`sequence_feature`, and `ppi`.

The resource registry owns each stable ID and any permitted alternate member identifiers:
`taxon_id`, `genome_id`, `feature_id` (alternate `patric_id`), `epitope_id`, `assay_id`,
`id`, `id`, `id`, `id`, `pdb_id`, `exp_id`, `bioset_id`, `sequence_id`, `id`, and `id`,
respectively.
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
selected rows, and exports are `no-store`, as is every response served while
`E2E_MOCK_ENABLED=1` (per-run fixture data must not be shared across runs). The single
decision behind both the response header and the upstream cache init lives in
`src/lib/data-api/server-policy.ts`. The gateway preserves client-safe upstream
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
  It always exposes the legacy GenomeList tab set; unsupported tabs are capability-gated.
  The Genomes tab reads the *effective* Genome predicate: the explicit `?rql=` when one is present;
  otherwise it is the implicit recent scope
  (`and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated))`) combined with any
  friendly structural filters. An explicit `rql` replaces that implicit scope rather than
  narrowing it, and so do a `keyword` (legacy GenomeList sends `keyword(...)` alone) and a
  `refine` refinement. The keyword is sent exact, `keyword(coli)`, as legacy sends it
  (134,274 genomes; the token-prefix `keyword(coli*)` found 137,836).
  The related-resource tabs (Sequences, Features, Proteins, Protein Structures, Domains
  and Motifs) follow legacy GenomeList, which hands its own query verbatim to each tab's
  collection, wherever that works (`genomeRelatedScope`). On an unscoped list each tab
  lists its whole collection, by its own `eq(<id>,*)` because the Data API rejects an
  empty query once a sort or facet is added; on a keyword- or refinement-only list each
  runs those `keyword(...)` clauses on its own collection, built as the Genomes tab builds
  its own (one exact clause per term through `keywordClauses`, for the keyword and the
  refinement alike), so it covers the same records as the Genomes tab: `coli Salmonella` is
  `and(keyword(coli),keyword(Salmonella))` on every tab, 1,933 genomes and 38 structures
  as on legacy, where the quoted phrase would find 29 and 0. Solr's `OR` and `NOT` stay
  on this path too (`?keyword=coli OR Salmonella` runs `or(keyword(coli),keyword(Salmonella))`
  on every tab, as legacy hands its search box's `or(...)` to each), where `?rql=` would
  join. A keyword typed into the
  tab's own box is exact too (`ResourceChildCollection`'s `serverKeywordMode`, also used
  by export and select-all). Any friendly filter, `public` scope or `rql` keeps the
  `genome(<effective predicate>)` join, because legacy's pass-through sends those genome
  fields to the child collection and gets HTTP 400. A quoted phrase is one clause on every
  tab (`keyword("DNA polymerase")`: 17 genomes, 16,199 sequences, as on legacy). The Features tab carries `/feature`'s
  removable `annotation=PATRIC` default (`features.annotation=*` once removed), and
  Features and Proteins rows stay in backend order. The unscoped Genomes tab keeps the
  recent scope, where legacy loads no rows.
  `/feature` has no implicit genome scope: its old recent-genome `genome()` join was a
  cross-collection Solr join costing 40–120 s per keyword query. It does select legacy
  FeatureList's removable `annotation=PATRIC` default (§2.8), and while that default is
  untouched its facet counts leave it out, so the annotation facet still shows RefSeq.
  The default stays beside an explicit `rql` that does not filter on `annotation`, as on
  legacy (an rql that does filter on it replaces the default, where legacy still ANDs
  PATRIC: §2.8): the Genome overview's count links (`/feature?rql=and(eq(genome_id,83332.12),
  eq(feature_type,CDS))`) list the 4,367 PATRIC CDS they count, not all 8,356, and the user
  can remove the chip (`&annotation=*`) without losing the link's rql. DXKB's own links that
  pin `eq(annotation,PATRIC)` (sequence and taxon FEATURES actions, the sequence ID link)
  replace the default with their own clause. The Proteins search
  (`filter=protein`) has no default (`featureListOptionsFor`): its `proteinFeatureRql`
  already pins `eq(annotation,PATRIC)`, so a removable chip would change nothing, as
  legacy ProteinList's removal changes nothing (2,122,451 rows for Dnak either way). A `keyword` is sent
  exact, `keyword(Dnak)`, and rows stay in backend order: legacy's
  `sort(+genome_name,+accession,+start)` costs 0.4–2.8 s per keyword page and needs a
  multi-key sort the Data API contract does not have.
- `/genome/{genomeId}` validates and fetches the exact `genome_id`, renders the member
  overview, and owns explicit member-tab composition. Its Features tab carries `/feature`'s
  removable `annotation=PATRIC` default (`features.annotation=*` once removed), as legacy's
  Genome Features tab does; the Proteins tab's RQL pins PATRIC itself.
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
- A legacy keyword query on FeatureList, ProteinList or GenomeList (beside at most one
  `sort(...)`, which is dropped) becomes `?keyword=` instead of `?rql=`, so the Feature
  list's PATRIC default and the Genome list's related-tab pass-through apply as on legacy,
  wherever `?keyword=` reads the query back as written (`readsAsWritten`,
  `searchBoxKeyword`):
  - a lone `keyword(x)` (`/view/FeatureList/?keyword(Dnak)` → `/feature?keyword=Dnak`) and
    legacy's search-box form for several words, `and(keyword(coli),keyword(Salmonella))` →
    `/genome?keyword=coli+Salmonella`: unquoted words (the Data API matches
    `keyword(coli Salmonella)` like the per-word clauses, 1,933 genomes), a quoted word or
    phrase, sent whole with its quotes (`keyword("Rv0001")`: 1 PATRIC feature, 341,190
    unquoted; `keyword("DNA polymerase")`: 16,285,620 PATRIC features against 22,504,678
    for the words apart), Solr's `AND`, `NOT` and `-` (`keyword(coli NOT Salmonella)` and
    `keyword(coli -Salmonella)` are both 132,341 genomes), and punctuation Solr splits a
    word at (`keyword(coli-K12)`, `keyword(H1N1/2009)`); `keyword(GO:0003677)`, an HTTP 400
    as written, goes there too and gets an answer;
  - alpha's search-box `or(...)`/`not(...)` form, an `and` of `keyword(term)`,
    `not(keyword(term))` and `or(keyword(term),…)` with one word or phrase per keyword
    (`/view/GenomeList/?or(keyword(coli),keyword(Salmonella))` →
    `/genome?keyword=coli+OR+Salmonella`, 195,658; `and(keyword(kinase),not(keyword(hypothetical)))`
    → `?keyword=kinase+NOT+hypothetical`), so its related tabs run it on their own
    collections, as alpha's do, rather than through the `genome()` join;
  - a lone `keyword(...)` with `OR` (or `||`) is first rewritten as RQL, since beside any
    other clause the OR would leak out of it (§2.8), and then reads back:
    `keyword(coli OR Salmonella)` → `/genome?keyword=coli+OR+Salmonella`, 195,658 as on
    legacy. Solr reads an `OR` beside other words oddly (`keyword(E coli OR Salmonella)` is
    502,671 genomes, `E` alone); the rewrite sends what the text says, 25,228. A NOT inside
    the OR is rewritten as Solr reads it and stays `?rql=`
    (`keyword(coli OR NOT Salmonella)` → `?rql=or(keyword(coli),not(keyword(Salmonella)))`,
    coli AND NOT Salmonella, 132,341 as on legacy).
  Everything else stays `?rql=`, as written: an open quote, a quote inside a word,
  `keyword(*)`, a keyword beside another clause, Solr syntax that works as written and that
  `?keyword=` reads differently (a boost `keyword(coli^2)`, a range `keyword(<coli)`, a
  regular expression `keyword(/col/)`), alpha's search-box form with a NOT inside an OR or
  only NOTs (§2.8), and an `and` of keywords whose joined text would read differently (a
  value ending in an operator, `and(keyword(coli OR),keyword(Salmonella))`).
  On `/genome` that `?rql=` puts the related tabs on the `genome()` join; on `/feature` the
  PATRIC default applies beside it unless the rql filters on `annotation`.
- Legacy name → segment via the registry reverse-map (`legacySingular`/`legacyList`).
- Named query params (`pathogen_test_type`, `test_type`, `accession`, `path`, `filter`)
  carried/mapped per the legacy doc.
- Emits a `308`; the browser **auto-preserves the `#hash`** across the redirect.

**Stage 2 — client (hash → `?tab=`):**

- A small `LegacyHashAdapter` client component mounted in `(views)/layout.tsx` reads any
  leftover `#view_tab=x` (and `#filter=`, `#accession=`) after mount and rewrites it to the
  equivalent query param via `history.replaceState` (no reload).
- `#filter=false` (legacy's "default filter removed") is dropped, except where DXKB carries
  that default: on `/feature` it becomes `annotation=*` (not beside an `rql` that filters on
  `annotation`, nor on the Proteins search, `filter=protein`); with `#view_tab=features` it
  becomes `features.annotation=*` on `/genome` and `/genome/{id}` (the Features tab's child
  URL key) and `annotation=*` on `/taxonomy/{id}`: the PATRIC default, removed (§2.8,
  §5.6).
- Known gap (pre-existing): a legacy `#filter=<rql>` (a filter picked in legacy's panel,
  e.g. `#filter=eq(annotation,RefSeq)`) is not carried over. The adapter copies it to
  `?filter=`, but the Feature list accepts only a plain feature type there
  (`parseFeatureCollectionState`) and drops it, so its PATRIC default applies again.

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
