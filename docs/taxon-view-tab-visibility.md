# Taxon View — How Tabs Are Shown or Hidden

A conceptual guide to the logic that decides which tabs appear on a BV-BRC
**Taxon View** page (`/view/Taxonomy/<id>`): why two viruses, or a virus and a
bacterium, end up with different tab sets, how each decision traces back to data
returned by the API, and how to carry the same model into a new React / Next.js
application.

This document is about the **model**, not the existing implementation. It
deliberately avoids legacy code so the rules stand on their own.

> **Implementation status (2026-06-24, DXKBCORE-181).** This model is implemented
> in `src/lib/taxon-view/` (`tab-policy.tsx` = the declarative table + `resolveTabs`,
> `predicates.ts` = the three predicate groups, `tab-context.ts`, `curated-lists.ts`,
> `phylo-manifest.ts`). The taxon page wires it via
> `src/app/(views)/taxonomy/[taxonId]/`. Two deliberate divergences from this doc:
> (1) conditional tabs that fail their gate are rendered **shown-but-disabled**
> (greyed, non-clickable, reason tooltip) rather than hidden — flipping to hard-hide
> is a one-line renderer change; (2) the curated cohort lists (`curated-lists.ts`) are
> a **placeholder** pending real product-data sources. The phylo manifest
> (`PHYLO_MANIFEST_URL`) defaults to the public BV-BRC manifest URL when unset —
> it is fetched on every taxon page load, not skipped. The Lassa-vs-RVFV
> class/order distinction from §5 is pinned by a regression test in
> `predicates.test.ts`.
>
> Of the bacterial cluster, only **AMR Phenotypes** and **Interactions** are
> implemented as tabs today; Specialty Genes, Pathways and Subsystems were removed
> from the strip until they have real views. AMR Phenotypes lists `genome_amr`
> rows scoped through the genome join, `and(eq(genome_id,*),genome(<lineage>))`,
> because `genome_amr` carries no `taxon_lineage_ids` (legacy sends the same query).

---

## 1. The core idea in one sentence

> A taxon's tab set is the universal baseline **plus** whichever conditional tabs
> its **taxonomy record** unlocks — and almost every unlock is a membership test
> against the taxon's *lineage*, so the rules are inherited down the tree.

Everything below expands that sentence. There is no per-taxon configuration, no
giant "if Influenza show X" switch. Each conditional tab has one predicate; you
evaluate the predicates against the taxon's data and render whatever passes.

---

## 2. The single source of truth: the taxonomy record

When the page loads, it fetches one record for the taxon ID in the URL
(`GET /api/taxonomy/<id>`). Three fields on that record drive every decision:

| Field | Shape | Role in tab logic |
|-------|-------|-------------------|
| `taxon_id` | number | Exact-match key for the one tab that doesn't inherit (virus Phylogeny). |
| `lineage_names` | ordered array of strings, root → leaf | The main lever. Most rules ask "does this array contain string X?" |
| `lineage_ids` | ordered array of numbers, parallel to `lineage_names` | Used where a rule matches by numeric id instead of name (SFVT). |

The lineage arrays are the whole reason the system feels "smart" without being
complicated. Because they list **every ancestor** from domain down to the current
taxon, a rule that checks for a family or class name automatically fires for every
species beneath it. You write the rule once at the level it makes biological
sense, and inheritance is free.

`taxon_rank` exists on the record but **no tab rule depends on it**. A genus page
and a species page get tabs by the same logic; rank only affects display copy.

### Why lineage, not the leaf name?

Matching the leaf (`taxon_name`) would force you to enumerate every descendant.
Matching the lineage lets you say "anything under Orthomyxoviridae" once. The
trade-off — and it matters when porting — is that you must pick the **right level**
in the lineage for each rule. Match too high and unrelated taxa inherit a tab;
match too low and real descendants miss it. §5 calls out a case where the chosen
level is surprising.

---

## 3. The two-layer structure: baseline + conditionals

Think of the tab strip as two layers.

**Layer 1 — the universal baseline.** These tabs appear for *every* taxon because
every taxon has the underlying data type (or an empty version of it). They need no
rule:

> Overview · Taxonomy · Genomes · Sequences · Features · Proteins ·
> Protein Structures · Domains and Motifs · Epitopes · Experiments

**Layer 2 — the conditional tabs.** Each is gated by exactly one predicate. They
fall into three groups by *what kind of data* the predicate consults:

1. **Organism-kind tabs** — unlocked by where the taxon sits in the tree of life
   (is it a bacterium? a virus? a particular viral family?). Source: `lineage_names`.
2. **Curated-cohort tabs** — unlocked because the taxon is on a hand-maintained
   list of pathogens for which a specialized data product exists. Source: a small
   static list (by id or by name).
3. **Data-availability tabs** — unlocked because a companion dataset actually
   exists for that exact taxon. Source: a remote manifest the page fetches.

The next section walks each conditional tab and ties it to its data source and its
*reason for existing*.

---

## 4. Every conditional tab, and the reason behind it

### 4.1 The bacteria/virus split (the biggest divider)

The largest difference between any bacterium and any virus comes from one fact:
**bacterial and viral biology need different analyses**, so they expose different
tools.

- If the lineage contains **`Bacteria`**, the taxon is treated as bacterial and
  gains: **AMR Phenotypes, Specialty Genes, Pathways, Subsystems, Interactions,**
  and a **(bacterial) Phylogeny**. These reflect things that are meaningful for
  cellular organisms with metabolism and antibiotic resistance.
- If the lineage contains **`Viruses`**, none of those appear. Viruses don't have
  metabolic pathways or AMR phenotypes in the same sense, so the tabs would be
  empty and are simply not shown.

The check looks no deeper than the single word `Bacteria`. That is why bacteria
from wildly different phyla — Gammaproteobacteria, Bacillota, Actinomycetota — all
present the **identical** bacterial tab set. The system makes no finer distinction
among bacteria here.

**Why it's binary:** the underlying model assumes a taxon is either cellular
(bacterial-style tooling) or viral (viral-style tooling). A taxon that is neither
(a eukaryotic host, archaea) is an edge case the original logic didn't fully
account for — worth handling explicitly in a rewrite (§6).

### 4.2 Strains — for segmented viruses

Some viruses have **segmented genomes** (their genome is split across several
physical pieces). For those, a "strain" is a meaningful unit that ties segments
together, so a dedicated Strains tab exists.

- Unlocked when the lineage contains **Orthomyxoviridae** (influenza and
  relatives) **or** the class **Bunyaviricetes**.
- These two groups have *different* segmentation biology, so there are actually two
  distinct Strains views behind the one label — the lineage picks which one.

**Why it's gated this way:** a Strains tab only makes sense where multi-segment
strains exist. Non-segmented viruses (e.g. coronaviruses, flaviviruses) never show
it. See §5 for an important subtlety about *which* taxonomic level the bunyavirus
check targets — it's the source of the least-obvious behavior in the whole system.

### 4.3 Surveillance & Serology — for actively-surveilled pathogens

These two tabs surface human/animal/avian surveillance records and serology study
data. That data only exists for a **small set of pathogen groups** under active
public-health surveillance.

- Unlocked when the lineage contains a specific pathogen name (in practice,
  influenza and Rhinovirus A).
- This is a **curated cohort**, not a biological category. The list is short and
  hand-maintained; it grows when a new surveillance data product is added.

**Why it's gated this way:** showing a Surveillance tab for a pathogen with no
surveillance data would be misleading. The tab's presence is a promise that the
data is there — so the gate is an explicit allow-list.

### 4.4 Sequence Feature Variant Types (SFVT) — for variant-typed viruses

SFVT is a specialized analysis (cataloguing variant types of sequence features)
that has been curated only for **certain viruses**.

- Unlocked when **any id in the lineage** appears on a curated SFVT taxon list.
- Because it checks the whole lineage by id, the tab is inherited by descendants of
  a listed taxon.

**Why it's gated this way:** like Surveillance, SFVT data exists only where someone
built it. The predicate is membership in a curated list. Notably this list has
**no biological pattern** — a large DNA virus and a small RNA virus can both be on
it — because the gate reflects *curation effort*, not virus morphology. Don't try
to infer the rule from what kind of virus it is.

### 4.5 Phylogeny (viral) — only where a tree actually exists

Bacteria get a phylogeny computed on the fly, but **viral phylogenetic trees are
precomputed and published per taxon**. The viral Phylogeny tab should appear only
when such a tree file exists for *that* taxon.

- The page fetches a remote **manifest** listing which taxa have a published tree,
  and shows the tab only if the taxon's **exact `taxon_id`** is a key in it.
- This is the **one rule that does not inherit**. It's an exact-id match, not a
  lineage match — a species does **not** automatically get its family's tree.

**Why it's gated this way:** this gate is about *data availability*, not
taxonomy. The manifest is the authoritative list of "trees that exist," so the tab
mirrors reality: present exactly when there's a tree to show. The non-inheritance
is deliberate (a family-level tree isn't necessarily the right tree for one
species), though whether that's the desired product behavior is a fair question to
revisit (§6).

---

## 5. Observed behavior across eleven taxa

The table below was produced by loading each page on a running server and reading
the rendered tab strip. It's the ground truth the rules above must reproduce.
● = shown, ─ = hidden. Baseline tabs (always present) are omitted; only the
conditional tabs appear.

| # | Taxon | id | Kind | Phylo | Strains | Surv. | Sero. | SFVT | AMR | Spec.Genes | Pathways | Subsys. | Interact. |
|---|-------|----|------|:-----:|:-------:|:-----:|:-----:|:----:|:---:|:----------:|:--------:|:-------:|:---------:|
| 1 | Hepatitis E virus | 291484 | virus | ─ | ─ | ─ | ─ | ─ | ─ | ─ | ─ | ─ | ─ |
| 2 | SARS‑CoV‑2 | 2697049 | virus | ─ | ─ | ─ | ─ | ─ | ─ | ─ | ─ | ─ | ─ |
| 3 | Dengue virus | 12637 | virus | ─ | ─ | ─ | ─ | ● | ─ | ─ | ─ | ─ | ─ |
| 4 | Monkeypox virus | 10244 | virus (DNA) | ─ | ─ | ─ | ─ | ● | ─ | ─ | ─ | ─ | ─ |
| 5 | Rift Valley fever virus | 11588 | virus | ─ | ● | ─ | ─ | ─ | ─ | ─ | ─ | ─ | ─ |
| 6 | Alphainfluenzavirus influenzae | 2955291 | virus | ● | ● | ● | ● | ● | ─ | ─ | ─ | ─ | ─ |
| 7 | Escherichia coli | 562 | bacteria | ● | ─ | ─ | ─ | ─ | ● | ● | ● | ● | ● |
| 8 | Staphylococcus aureus | 1280 | bacteria | ● | ─ | ─ | ─ | ─ | ● | ● | ● | ● | ● |
| 9 | Pseudomonas aeruginosa | 287 | bacteria | ● | ─ | ─ | ─ | ─ | ● | ● | ● | ● | ● |
| 10 | Salmonella enterica | 28901 | bacteria | ● | ─ | ─ | ─ | ─ | ● | ● | ● | ● | ● |
| 11 | Mycobacterium (genus) | 1763 | bacteria | ● | ─ | ─ | ─ | ─ | ● | ● | ● | ● | ● |

What the spread teaches:

- **Viruses are not uniform.** Two (Hep E, SARS‑CoV‑2) trip *zero* conditional
  rules and look almost like a "bare" taxon. The rest each trip a different subset.
  Influenza is the only taxon that trips every viral rule at once — which is why it
  was the original example of "the page with all the extra tabs."
- **"Phylogeny" is two different tabs** sharing a label: a precomputed viral tree
  (data-availability gate) and a bacterial tree (organism-kind gate). They never
  appear together because a taxon is virus *or* bacterium.
- **Bacteria are uniform** across three different phyla. The gate is the single
  word `Bacteria`; nothing finer is consulted. Rank doesn't matter either — the
  genus `Mycobacterium` and the species `E. coli` match identically.
- **DNA vs. RNA is irrelevant.** Monkeypox (large dsDNA) and Dengue (small +ssRNA)
  land on the same set because both are on the SFVT list. The gate is curation, not
  biology.

### The one genuinely surprising case

**Rift Valley fever shows Strains; a "textbook bunyavirus" like Lassa would not.**
This is the most important subtlety to understand before porting.

The Strains rule for bunyaviruses checks for the **class `Bunyaviricetes`** in the
lineage. After NCBI's taxonomy reorganization, the familiar grouping split:

| Taxon | Where the relevant level sits in its lineage | Contains `Bunyaviricetes`? | Strains? |
|-------|----------------------------------------------|:--------------------------:|:--------:|
| Rift Valley fever virus (11588) | …**Bunyaviricetes** (class) → Hareavirales → Phenuiviridae… | yes | **shown** |
| Lassa mammarenavirus (11620) | …Ellioviricetes (class) → **Bunyavirales** (order) → Arenaviridae… | no | **hidden** |

So a virus whose lineage contains the *order* `Bunyavirales` is **not** matched,
because the rule keys on the *class* `Bunyaviricetes` instead. The two names look
interchangeable but now live in different branches. The lesson for the new project:
**a lineage-membership rule is only as correct as the taxonomic level it targets**,
and taxonomy changes over time. Pin the level deliberately and write a test that
documents the intended coverage (both names? just one?).

---

## 6. The mental model, distilled

To decide a taxon's tabs:

1. Start with the **baseline** (always shown).
2. Read the taxonomy record's `lineage_names`, `lineage_ids`, `taxon_id`.
3. For each conditional tab, evaluate its single predicate:
   - **Organism-kind** (`Bacteria` / `Viruses` / a family / a class in
     `lineage_names`) → the bacterial cluster, or Strains.
   - **Curated cohort** (a name or id on a hand-maintained list) → Surveillance,
     Serology, SFVT.
   - **Data availability** (taxon present in a remote manifest) → viral Phylogeny.
4. Show the union of the baseline and whatever passed.

Three orthogonal questions sit behind the three groups, and they answer *different
things*:

| Group | The question it answers | Changes when… |
|-------|-------------------------|---------------|
| Organism-kind | "What *is* this organism?" | …never (taxonomy is stable-ish). |
| Curated cohort | "Did we *build* a special product for it?" | …a team curates a new dataset. |
| Data availability | "Does the artifact *exist right now*?" | …a pipeline publishes/removes a file. |

Keeping these separate in your head (and in code) prevents the classic bug of
gating a "we built it" feature on a biological category, or vice versa.

---

## 7. Carrying this into a React / Next.js app

The legacy approach mutated a tab container imperatively. In React the same model
becomes **declarative and data-driven**, which is both simpler and more testable.

### 7.1 Make each rule a small data descriptor

Represent the policy as a list of tab definitions, each carrying a `visible(ctx)`
predicate, rather than scattering `if` blocks through the view. The context object
is just the three data sources:

```
TabContext = {
  taxonomy:     the API record (taxon_id, lineage_names, lineage_ids),
  phyloManifest: the remote manifest (taxon_id → tree),  // data-availability
  curatedLists:  { sfvtTaxonIds, surveillanceNames, ... } // curated cohorts
}
```

Each predicate is a one-liner expressing exactly the logic from §4, e.g. "lineage
includes `Bacteria`", "taxon_id is a key in `phyloManifest`", "some lineage id is
in `sfvtTaxonIds`". `visibleTabs(ctx)` filters the list. The view renders the
result — no imperative add/remove.

Benefits that fall out of this shape:
- The whole policy lives in one file you can read top to bottom.
- Each rule is unit-testable in isolation against a fake taxonomy record.
- Adding a tab or a cohort is a data edit, not a control-flow change.

### 7.2 Fetch the gating data on the server

Both inputs are cacheable and small. Fetch the **taxonomy record** and the
**phylogeny manifest** in the server component / route loader so the tab strip is
correct on first paint — no client-side flicker of tabs appearing late, and the
page is SEO-friendly. Cache the taxonomy record briefly and the manifest longer
(it changes rarely).

If the manifest fetch fails, **fail open**: render every other tab and just omit
the viral Phylogeny tab. A missing manifest should never block the page.

### 7.3 Separate the visibility decision from the active-tab decision

Which tab is *open* is independent of which tabs are *shown*. The open tab comes
from the URL (`?view_tab=` / `#view_tab=`), defaulting to Overview. Two rules keep
this robust:

- Always resolve the requested tab against the **visible** set; if a bookmarked
  URL asks for a tab that's hidden for this taxon (e.g. `view_tab=amr` on a virus),
  fall back to the default rather than showing nothing.
- Changing tabs is a URL change, so deep links and back/forward "just work."

### 7.4 Move curated lists out of code

The SFVT list and the Surveillance/Serology name list are **product data**, not
logic — they change on a curation cadence, not a release cadence. Prefer either a
small committed config file or, better, a single API endpoint that returns the
current policy:

```
GET /api/taxon-view/tab-policy
{
  "sfvtTaxonIds": [...],
  "surveillanceLineageNames": ["Alphainfluenzavirus influenzae", "Rhinovirus A"]
}
```

Driving the curated cohorts from the API means the frontend ships **zero**
hard-coded taxa, and the lists can change without a deploy. It also removes a class
of drift bug that exists today (a curated id getting out of sync with the data it
points at).

### 7.5 Be deliberate about the taxonomy-level rules

Two of the §4 rules match a taxonomic rank that can shift over time
(Orthomyxoviridae / Bunyaviricetes for Strains; the curated names for Surveillance).
When you port them:

- Decide the exact token(s) each rule should match and write a test that encodes
  the intended coverage — including the Lassa-vs-RVFV distinction from §5, so a
  future taxonomy update can't silently change which taxa get the tab.
- Handle the "neither bacterium nor virus" case explicitly instead of relying on a
  default context, so hosts/archaea get a sensible (probably baseline-only) set.

---

## 8. Quick reference

**Baseline (always shown):** Overview, Taxonomy, Genomes, Sequences, Features,
Proteins, Protein Structures, Domains and Motifs, Epitopes, Experiments.

**Conditional tabs and their gates:**

| Tab(s) | Group | Gate (data source) | Inherits down lineage? |
|--------|-------|--------------------|:----------------------:|
| AMR, Specialty Genes, Pathways, Subsystems, Interactions, Phylogeny (bact.) | organism-kind | `lineage_names` contains `Bacteria` | yes |
| Strains | organism-kind | `lineage_names` contains `Orthomyxoviridae` or `Bunyaviricetes` | yes |
| Surveillance, Serology | curated cohort | `lineage_names` contains a curated pathogen name | yes |
| SFVT | curated cohort | a `lineage_ids` entry is on the curated SFVT list | yes |
| Phylogeny (viral) | data availability | `taxon_id` is a key in the remote tree manifest | **no (exact id)** |

**The three questions, kept separate:** what the organism *is* (taxonomy) · whether
a product was *built* for it (curation) · whether the artifact *exists* now
(manifest).
