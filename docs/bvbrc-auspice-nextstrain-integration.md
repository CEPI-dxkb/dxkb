# What Makes Auspice / Nextstrain Show Up in the Taxon-View Phylogeny Tab

**Scope.** The Taxon View phylogeny tabs at `/view/Taxonomy/<id>#view_tab=phylogeny`
and `#view_tab=phylogenyVirus`. Answers: why H3N2 has Nextstrain but H5N1 doesn't,
why Coronaviridae has none, why no bacterium ever does, and what the real limits are.

**Verified against** this checkout (branch `alpha`, `auspice@2.73.2`), the live
content API (`https://www.bv-brc.org/api/content/...`), and a running
`localhost:3000`. Numbers below are as-fetched on 2026-08-04. DXKB now builds
`auspice@3.2.0`; the dataset and panel findings below do not depend on the
Auspice version. For the 3.x map and its tile host, see
`docs/phylogeny-integration.md` → "Auspice map".

---

## 0. TL;DR

Nextstrain/Auspice appears **only when a curated JSON file happens to exist**, in
two places at once. There is no computation, no fallback, no per-organism logic:

1. A **content-API manifest entry** must list the tree under `"nextstrain": [...]`
   for that exact taxon ID.
2. A matching **v2 Auspice dataset JSON** must sit on disk in the web server's
   `NEXTSTRAIN_DATASET_DIR`.

Today that is **13 manifest entries pointing at 11 distinct datasets, across 3 taxa**,
out of 154 manifest taxa and 339 total trees (326 Archaeopteryx + 13 Nextstrain).
Everything else falls back to Archaeopteryx.

Nothing in the code says "viruses only." The **manifest just happens to contain
only viral family taxa** — bacteria are gated out by absence, not by a rule.

| Question | Answer |
|---|---|
| Why H3N2 but not H5N1? | H5N1's group in the manifest has `"nextstrain": []`. Nobody built the datasets. |
| Why no Coronaviridae? | Same — its one group is Archaeopteryx-only. |
| Why no bacteria? | Bacterial taxon IDs aren't in the viral manifest at all, so the whole tab is hidden; bacteria get a different tab off a different manifest. |
| Could bacteria work? | Yes, after implementing a bacterial Auspice renderer and the corresponding tab/widget changes. It remains a data-production problem, plus one real scale ceiling (§6). |

---

## 1. Two different tabs, two different manifests

Both are literally titled "Phylogeny", both occupy tab slot 1. Which one you get
depends on which manifest names your taxon.

|                       | Bacterial tab (`phylogeny`)                              | Viral tab (`phylogenyVirus`)                     |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| Widget                | `public/js/p3/widget/Phylogeny.js`                       | `public/js/p3/widget/PhylogenyVirus.js`          |
| Manifest              | `…/api/content/bvbrc_phylogeny_tab/taxon_tree_dict.json` | `…/api/content/phyloxml_trees/manifest.json`     |
| Manifest shape        | `{taxon_id: "<phyloxml filename>"}`                      | `{taxon_id: "<family name>"}`                    |
| Entries               | **499,508** taxon IDs → 2,900 distinct files             | **154** taxon IDs                                |
| Trees per taxon       | exactly 1                                                | 1–17, grouped, with a faceted card picker        |
| Renderers             | Archaeopteryx only                                       | Archaeopteryx **and/or** Nextstrain              |
| Added to tab strip by | `changeToBacteriaContext()`, unconditionally             | `_toggleTab(this.phylogenyVirus, shouldShow, 1)` |

Wiring: `public/js/p3/widget/viewer/Taxonomy.js:21-22` (both manifest URLs live on
the same class), `:120` (viral gate), `:73` (bacterial add), `Phylogeny.js:347`
(bacterial manifest fetch).

**The bacterial tab has no Auspice code path at all.** `Phylogeny.js` imports
`window.archaeopteryx` directly and has no branch for anything else. Even if you
produced a bacterial Auspice dataset tomorrow, this widget could not render it.

---

## 2. The actual gate, step by step

### 2.1 Is the viral tab even shown?

`Taxonomy.js:530`:

```javascript
_taxonHasPhyloData: function (manifest, taxon_id) {
  return manifest !== null && manifest.hasOwnProperty(taxon_id);
}
```

**Exact `taxon_id` match. No lineage inheritance.** This is the one Taxon-View tab
that doesn't inherit down the tree (see `docs/taxon-view-tab-visibility.md` §2), and
it's the biggest source of "why isn't it here?" confusion:

- `/view/Taxonomy/11118` (Coronaviridae, family) → in manifest → **tab shows**
- `/view/Taxonomy/694009` (SARS-CoV-2, species, a descendant) → **not** in manifest → **no tab**
- `/view/Taxonomy/561` (Escherichia) → not in manifest → no viral tab

Manifest keys are overwhelmingly **family**-rank viral taxa (`Coronaviridae`,
`Filoviridae`, `Poxviridae`, …) plus two exceptions: `2955291` "Influenza A virus"
and `3044781` "Orthoebolavirus" (a genus).

### 2.2 What trees does the tab offer?

If gated in, `Taxonomy.js:134` fetches
`…/phyloxml_trees/families/<taxon_id>/<taxon_id>.json`. Shape:

```json
{
  "order": ["h3n2", "h5n1"],
  "groups": [
    {
      "key": "h3n2",
      "title": "Influenza A (H3N2) Seasonal Outbreaks",
      "archaeopteryx": [
        {
          "name": "...",
          "path": "https://…/segment_4_clade.xml",
          "region": "global",
          "metadata": "https://…tar.gz"
        }
      ],
      "nextstrain": [
        {
          "name": "...",
          "path": "Influenza-A-Virus/H3N2/HA",
          "region": "global"
        }
      ]
    }
  ]
}
```

**`"nextstrain"` is a hand-authored array.** Non-empty → Nextstrain cards render.
Empty or absent → they don't. That's the entire rule.

Note the two `path` conventions: Archaeopteryx paths are absolute URLs to phyloXML;
Nextstrain paths are **Auspice dataset request strings**, resolved relatively
(`PhylogenyTreeCards.js:580` only prepends the base URL for leading-`/` paths).

### 2.3 Rendering the choice

`PhylogenyTreeCards.js:508-509` renders an "Archaeopteryx" section then a
"Nextstrain" section per group card. The left **Viewer filter** panel only appears
when _both_ exist (`:366` — `arcTotal > 0 && nxtTotal > 0`), which is why H3N2 shows
the filter and Coronaviridae doesn't.

Selection routes by section label — `PhylogenyVirus.js:141`:

```javascript
var isNextstrain = payload.section === "Nextstrain";
```

Nextstrain → an iframe at `/nextstrain-viewer/<path>` (`:180`), and the
Archaeopteryx action bar (Guide / Download-metadata) is hidden. Archaeopteryx →
in-page `OutbreaksPhylogenyTreeViewer`.

### 2.4 Serving the dataset

The iframe boots the custom Auspice SPA (`app.js:318` → `public/js/auspice-custom/dist`),
which turns its own pathname into a Charon call:

```text
/nextstrain-viewer/Influenza-A-Virus/H3N2/HA
  → GET /charon/getDataset?prefix=nextstrain-viewer/Influenza-A-Virus/H3N2/HA
  → routes/auspice.js strips the "nextstrain-viewer/" prefix (:19-36)
  → auspice/cli/server/getDataset reads NEXTSTRAIN_DATASET_DIR
  → lib/auspice-datasets/Influenza-A-Virus_H3N2_HA.json
```

Path→filename mapping is `parts.join("_")` (`getDatasetHelpers.js:104`) and the
reverse on listing is `split("_").join("/")` (`getAvailable.js:31`).

> **Authoring constraint:** an underscore in any path segment silently becomes a
> path separator. Use dashes — hence `Influenza-A-Virus`, not `Influenza_A_Virus`.

---

## 3. What actually exists today

### 3.1 Manifest inventory (all 154 taxa fetched)

|                                   | Count   |
| --------------------------------- | ------- |
| Manifest taxa                     | 154     |
| Tree groups                       | 157     |
| Archaeopteryx tree entries        | **326** |
| Nextstrain tree entries           | **13**  |
| Distinct Nextstrain dataset paths | **11**  |
| Taxa offering _any_ Nextstrain    | **3**   |

The complete list of taxa with a Nextstrain option:

| Taxon             | ID      | Arch | Nextstrain                    |
| ----------------- | ------- | ---- | ----------------------------- |
| Influenza A virus | 2955291 | 17   | 9 (H3N2 only)                 |
| Filoviridae       | 11266   | 4    | 2 (Ebola Outbreak 2026 group) |
| Orthoebolavirus   | 3044781 | 2    | 2                             |

The other **151 taxa are Archaeopteryx-only** — Coronaviridae, Poxviridae,
Retroviridae, Paramyxoviridae, Hantaviridae, and 146 more.

### 3.2 Influenza A, the case in the question

`/view/Taxonomy/2955291` has two groups:

- **h3n2** "Influenza A (H3N2) Seasonal Outbreaks" — 9 Archaeopteryx, **9 Nextstrain**
  (Concat, PB2, PB1, PA, HA, NP, NA, M1, NS1)
- **h5n1** "Influenza A H5N1 2024-2026" — 8 Archaeopteryx, **0 Nextstrain**

So H5N1 isn't broken or excluded. Its `"nextstrain"` array is empty, and no
`Influenza-A-Virus_H5N1_*.json` exists in `lib/auspice-datasets/`. Nobody ran the
build for it.

### 3.3 Datasets on disk

`lib/auspice-datasets/` contains exactly the 9 H3N2 files, all committed in
`3b208eb56 initial nexstrain/auspice implementation`, all ~190 KB, 547–554 tips.
Uniform metadata: `panels: ["tree","map"]`, colorings `host / num_date / country /
region / clade / subclade`, `build_url: https://github.com/nextstrain/flu`,
`updated: 2026-03-23`.

### 3.4 A live gap: Orthoebolavirus 404s

Filoviridae and Orthoebolavirus advertise `Orthoebolavirus/100` and
`Orthoebolavirus/500`, but no such file exists locally. Confirmed:

```text
GET /charon/getDataset?prefix=Orthoebolavirus/100  → 404 "couldn't fetch JSONs"
```

Those four cards are dead in this checkout. (Production sits behind a Cloudflare
challenge, so whether prod ships the Ebola files could not be verified from here —
check the deployed `NEXTSTRAIN_DATASET_DIR`.) The manifest and the dataset directory
are **maintained independently, with no consistency check**, so this class of
mismatch is unpoliced. See §7.

---

## 4. Why this is deployment-fragile

`routes/auspice.js:12` reads `process.env.NEXTSTRAIN_DATASET_DIR`. The only place it
is set is `package.json:6`:

```json
"start": "NEXTSTRAIN_DATASET_DIR=./lib/auspice-datasets node ./bin/p3-web"
```

It is **not** in `p3-web.conf`, not in `config.js`, not in `bin/p3-web`. Consequences:

- Start the server any way other than `npm start` and the var is undefined.
- Undefined does not crash. `getAvailableDatasets(undefined)` logs one warning and
  returns `[]` (verified), so **every** Nextstrain card 404s while the rest of the
  site looks perfectly healthy.

Second fragility: `public/js/auspice-custom/dist/` is gitignored
(`.gitignore:29-30`) and built by `npm run build:nextstrain` / `buildClient.sh:50-53`.
Skip that build and `app.js:297` serves a "Nextstrain viewer not built" placeholder
inside the iframe.

---

## 5. Limitations and sharp edges

### 5.1 Silent wrong-dataset redirect

Auspice's `redirectIfDatapathMatchFound` walks path fragments and redirects to the
"best match" rather than 404ing. Verified locally:

```text
GET /charon/getDataset?prefix=Influenza-A-Virus/H5N1/HA
  → 302 → prefix=/Influenza-A-Virus/H3N2/Concat
  → 200, title "H3N2 Influenza Phylogeny"
```

**A request for an H5N1 tree silently returns an H3N2 tree.** No card produces this
URL today, but any future H5N1 card added before its datasets ship would display
wrong data with no error. Worth a guard if H5N1 cards land first.

### 5.2 Panels are effectively tree + map only

Auspice enables the **entropy** panel only when `metadata.genome_annotations` exists
_and_ branches carry mutations (`recomputeReduxState.js:350-366`). Checked all 9
datasets: no `genome_annotations`, **0 branch mutation sets, 0 branch labels**. So no
entropy panel, no genotype coloring, and no clade branch labels.

### 5.3 The temporal axis is half-built

`num_date` is present on **550/550 tips but 0 internal nodes**, including the root.
Auspice reads the root only (`recomputeReduxState.js:471-476`):

```javascript
const numDateAtRoot = getTraitFromNode(tree.nodes[0], "num_date") !== undefined;
const divAtRoot     = getDivFromNode(tree.nodes[0]) !== undefined;
state.branchLengthsToDisplay = (numDateAtRoot && divAtRoot) ? "divAndDate" : …
```

Root has `{div: 0, host: …}` and no `num_date` → **`divOnly`**. That disables the
div/time metric switch, the animation controls, and the date-range inputs
(`choose-metric.js:23`, `animation-controls.js:54`, `date-range-inputs.js:82`).
Fixing this is an `augur refine`-style upstream change (time-resolve the tree so
internal nodes get dates), not a front-end one.

### 5.4 No sidecars, no tanglegram, no dataset list

- `?type=tip-frequencies|root-sequence|measurements` all 404 (no `*_tip-frequencies.json` etc.).
- `getAvailable` is hardcoded to `{datasets: [], narratives: []}` (`routes/auspice.js:39-41`)
  "to hide other options for now". That also kills Auspice's second-tree/tanglegram
  picker, which reads `secondTreeOptions` off that response
  (`choose-second-tree.js:33`), and leaves the custom Splash page listing nothing.

### 5.5 Iframe isolation

The viewer is an `<iframe>` (`PhylogenyVirus.js:179`). No selection sync with the
rest of the Taxon View, no participation in the p3 topic bus, no "add selection to
group". Archaeopteryx trees, being in-page, do get the action bar. Also
`_openNextstrainViewer` destroys and recreates the iframe on every card click — full
SPA reboot and dataset refetch per switch.

### 5.6 Metadata download asymmetry

Every Archaeopteryx entry carries a `metadata` tarball URL; **no** Nextstrain entry
does. The DWNLD button is hidden for Nextstrain cards
(`PhylogenyVirus.js:130-138`, `:142`).

---

## 6. Could it work for all viruses and bacteria?

Split the question in three.

### 6.1 Format — yes, with real work per tree

Auspice needs **v2 JSON** (`{version, meta, tree}` with `node_attrs`/`branch_attrs`).
The existing trees are **phyloXML** with `vipr:`-namespaced properties. Sampled:

| Tree                          | Bytes     | Property refs present                                                            |
| ----------------------------- | --------- | -------------------------------------------------------------------------------- |
| E. coli 561 (bacterial, GTDB) | 24 KB     | `BVBRC:In-Group`, minimal                                                        |
| Coronaviridae 100 (viral)     | 176 KB    | `vipr:Species/Subfamily/Strain/Host/Year/Collection_Date/Genus/Subgenus`         |
| H3N2 seg 4 (viral)            | 838 KB    | `vipr:Year/H3_clade/H3_shortclade/H3_legacyclade/Host/Host_Group/Region/Country` |
| H5N1 seg 4 (viral)            | **59 MB** | `vipr:Subtype/Strain/Species/Host/Host_Group/Subclade/Country/Region/…`          |

These carry the traits Auspice wants (host, country, region, year, clade), so a
phyloXML→v2 converter is very feasible. But:

- Trait **names differ per tree family** (`H3_clade` vs `Subclade` vs `Subgenus`), so
  `meta.colorings` must be derived per tree, not templated.
- `geo_resolutions` needs a **lat/long gazetteer** to render the map. The H3N2 files
  hand-embed 31 country + 5 region demes. Country strings in the phyloXML aren't
  guaranteed to match.
- No mutations anywhere → entropy panel stays off regardless.
- No internal-node dates → the time axis stays disabled (§5.3) unless trees are
  re-inferred, not merely converted.

Archaeopteryx, by contrast, discovers `vipr:*` properties dynamically at runtime and
needs zero per-tree configuration. That asymmetry is the honest reason Nextstrain
coverage is 13/339 and not growing on its own.

### 6.2 Scale — a hard ceiling on the big viral trees

H5N1 segment 4 is **59 MB of phyloXML, 13,207 annotated tips**. Auspice renders
every tip as an SVG node with no virtualization or decimation
(`globals.js` has no size guard). The working H3N2 datasets are ~190 KB / ~550 tips
— roughly **24× fewer tips**. A converted H5N1 dataset would be tens of MB over the
wire into an iframe.

This is likely the practical reason H5N1 shipped Archaeopteryx-only. Any H5N1
Nextstrain build needs subsampling (the standard `augur` approach), not a
straight conversion.

### 6.3 Bacteria — possible, but three blockers

Nothing in the gate is kingdom-aware. `_taxonHasPhyloData` just asks whether a key
exists. To light Nextstrain up for, say, _E. coli_:

1. **Manifest**: `561` would have to appear in `phyloxml_trees/manifest.json` with a
   family JSON exposing a `"nextstrain"` array. It currently doesn't — that manifest
   is 100% viral.
2. **Tab collision**: bacteria already get `phylogeny`, and `changeToBacteriaContext()`
   adds it unconditionally. A bacterium in the viral manifest would get **both** tabs,
   both titled "Phylogeny", both in slot 1. Needs explicit reconciliation.
3. **Semantics**: `PhylogenyVirus.js` hardcodes virus-shaped Archaeopteryx
   visualizations (Host, Host_Group_Domestic_vs_Wild, Subtype…) and
   `PhylogenyTreeCards.js` hardcodes influenza segment ordering
   (`['All','PB2','PB1','PA','HA','NP','NA','M1','NS1']`). Neither is meaningful for
   bacteria — harmless (the segment facet hides itself when <2 segments parse), but
   the widget name and config are viral by design.

Also note bacterial coverage today comes from a fundamentally different model:
499,508 taxon IDs → 2,900 phyloXML files, i.e. descendants **inherit** an ancestor's
GTDB tree. The viral side has no inheritance at all. Porting Nextstrain to bacteria
means picking one of those two models deliberately.

---

## 7. If you want to add a Nextstrain tree

1. Produce a **v2 Auspice JSON**. `meta.panels` should be `["tree","map"]`;
   `meta.geo_resolutions` needs explicit lat/long demes or the map won't render.
   For a working time axis, give **internal nodes** `num_date` too (§5.3).
2. Name it `Path_Parts_Joined_By_Underscore.json` in `NEXTSTRAIN_DATASET_DIR`
   (`lib/auspice-datasets/`). **No underscores inside a path segment** (§2.4).
3. Add an entry to that taxon's `families/<id>/<id>.json` under `"nextstrain"`, with
   `path` = the slash-form request string.
4. Verify end to end — the two sides are not cross-checked:
   ```bash
   curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' \
     'http://localhost:3000/charon/getDataset?prefix=<Your/Path>'
   ```
   Insist on a bare **200 with no redirect**. A 302 means you hit the
   nearest-match fallback and are about to display someone else's tree (§5.1).
5. Confirm the server was started with `NEXTSTRAIN_DATASET_DIR` set (§4) and that
   `npm run build:nextstrain` has produced `public/js/auspice-custom/dist/`.

**Worth fixing regardless of new content:** a startup check that every `"nextstrain"`
path in the manifest resolves to a file on disk. That single check catches the live
Orthoebolavirus 404s (§3.4) _and_ the `NEXTSTRAIN_DATASET_DIR`-unset failure (§4),
both of which currently fail silently and look identical to "no data".

---

## 8. File reference

| Concern                                          | File                                                           |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Viral tab gate, both manifest URLs               | `public/js/p3/widget/viewer/Taxonomy.js:21,22,119,120,134,530` |
| Viral tab host, Arch↔Nextstrain routing, iframe  | `public/js/p3/widget/PhylogenyVirus.js:141,159,180`            |
| Card grid, facets, Viewer filter                 | `public/js/p3/widget/PhylogenyTreeCards.js:366,508,580`        |
| Bacterial tab + its manifest                     | `public/js/p3/widget/Phylogeny.js:347,356`                     |
| Charon API shim, `getAvailable` stub             | `routes/auspice.js:12,19,39`                                   |
| SPA static serving, index rewrite                | `app.js:287-318`                                               |
| Auspice build                                    | `package.json:13`, `buildClient.sh:50-53`                      |
| Datasets on disk                                 | `lib/auspice-datasets/`                                        |
| Custom splash / navbar / theme                   | `public/js/auspice-custom/extend/`                             |
| Related: general tab-visibility model            | `docs/taxon-view-tab-visibility.md`                            |
| Related: current DXKB integration and operations | `docs/phylogeny-integration.md`                                |
