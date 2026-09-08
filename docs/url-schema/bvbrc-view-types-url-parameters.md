# BV-BRC View URL Parameters

Maps all URL parameter keys for the 20 primary views. Covers path segments, query string params, and hash params.

## How URL Parsing Works

Route handler in `public/js/p3/app/p3app.js`:

```javascript
Router.register('/view(/.*)', function (params, path) {
  var newState = getState(params, path);
  var parts = newState.pathname.split('/');
  parts.shift();
  var type = parts.shift(); // extracts ViewType
  newState.widgetClass = 'p3/widget/viewer/' + type;
  _self.navigate(newState);
});
```

`getState()` parses the full URL into the state object:

| URL component | State property | Notes |
|---|---|---|
| `/view/{ViewType}/{EntityID}` | `state.pathname` | Full path; viewers call `pathname.split('/')` to extract ID |
| `?{value}` | `state.search` | Raw query string (no leading `?`); contains RQL or named params |
| `#{key}={val}&{key}={val}` | `state.hashParams` | Parsed as key-value object |

**General URL structure:**
```
/view/{ViewType}/{EntityID}?{query_string}#{hash_params}
```

---

## Singular Entity Viewers

These load a single record identified by an ID in the URL path.

---

### Taxonomy

**Viewer file:** `public/js/p3/widget/viewer/Taxonomy.js`

**URL pattern:**
```
/view/Taxonomy/{taxon_id_or_name}#{hash_params}
```

**Examples:**
```
/view/Taxonomy/234#view_tab=overview
/view/Taxonomy/Brucella#view_tab=genomes
/view/Taxonomy/1763#view_tab=genomes&filter=false
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Path segment | `taxon_id` | NCBI taxonomy ID (integer). Alternatively accepts `taxon_name` (genus/species string) |
| Hash | `view_tab` | Active tab name. Default: `overview` |
| Hash | `filter` | RQL condition string or `false` to clear. Set via `onSetAnchor`. Example: `eq(genome_id,*)` |

**ID extraction (source):**
```javascript
// Taxonomy.js:183-203
var parts = state.pathname.split('/');
var taxon_id_or_name = parts[parts.length - 1];
if (taxon_id_or_name == parseInt(taxon_id_or_name)) {
  def.resolve(parseInt(taxon_id_or_name)); // numeric ID
} else {
  // resolves name via API: eq(taxon_name,{name})&in(taxon_rank,(genus,species))
}
```

---

### Genome

**Viewer file:** `public/js/p3/widget/viewer/Genome.js`

**URL pattern:**
```
/view/Genome/{genome_id}#{hash_params}
```

**Examples:**
```
/view/Genome/83332.12#view_tab=overview
/view/Genome/83332.12#view_tab=features&filter=eq(feature_type%2C%22CDS%22)
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Path segment | `genome_id` | BV-BRC genome ID (e.g., `83332.12`) |
| Hash | `view_tab` | Active tab name. Default: `overview` |
| Hash | `filter` | RQL condition for features/proteins tabs. Auto-set for host (eukaryote) genomes. Example: `eq(feature_type,%22CDS%22)` |

**`filter` hash param behavior:**
- Only applies to `features` and `proteins` tabs
- Auto-set when genome is a host organism (`taxon_lineage_ids` contains `2759`)
- `features` tab default: `eq(feature_type,%22CDS%22)`
- `proteins` tab default: `and(or(eq(feature_type,CDS),eq(feature_type,mat_peptide)),eq(annotation,PATRIC))`
- Can be overridden by supplying `filter` in the URL hash

**ID extraction (source):**
```javascript
// Genome.js:264-267
var parts = state.pathname.split('/');
this.set('genome_id', parts[parts.length - 1]);
state.genome_id = parts[parts.length - 1];
```

---

### Feature (user-facing: "Features")

**Viewer file:** `public/js/p3/widget/viewer/Feature.js`

**URL pattern:**
```
/view/Feature/{feature_id}#{hash_params}
```

**Examples:**
```
/view/Feature/PATRIC.83332.707.NC_000962.CDS.1.1524.fwd#view_tab=overview
/view/Feature/PATRIC.83332.707.NC_000962.CDS.1.1524.fwd#view_tab=genomeBrowser
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Path segment | `feature_id` | BV-BRC feature ID (PATRIC ID format) |
| Hash | `view_tab` | Active tab name. Default: `overview` |

**ID extraction (source):**
```javascript
// Feature.js:111-113
var parts = this.state.pathname.split('/');
this.set('feature_id', parts[parts.length - 1]);
state.feature_id = parts[parts.length - 1];
```

---

### Epitope (user-facing: "Epitopes")

**Viewer file:** `public/js/p3/widget/viewer/Epitope.js`

**URL pattern:**
```
/view/Epitope/{epitope_id}#{hash_params}
```

**Examples:**
```
/view/Epitope/12345#view_tab=overview
/view/Epitope/12345#view_tab=assays
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Path segment | `epitope_id` | Epitope ID (stored internally as `eid`) |
| Hash | `view_tab` | Active tab name. Default: `overview` |

**ID extraction (source):**
```javascript
// Epitope.js:26-29
var parts = state.pathname.split('/');
this.set('eid', parts[parts.length - 1]);
state.eid = parts[parts.length - 1];
this.eid = state.eid;
```

---

### ProteinStructure (user-facing: "ProteinStructures")

**Viewer file:** `public/js/p3/widget/viewer/ProteinStructure.js`

**URL pattern — database record:**
```
/view/ProteinStructure#{hash_params}
```

**URL pattern — workspace file:**
```
/view/ProteinStructure#path={workspace_path}
```

**Examples:**
```
/view/ProteinStructure#accession=6VXX
/view/ProteinStructure#accession=6VXX,7BZ5
/view/ProteinStructure#path=/username@bvbrc/home/mystructure.pdb
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Path segment | _(none)_ | No entity ID in path |
| Hash | `view_tab` | Active tab name |
| Hash | `accession` | PDB accession ID(s). Comma-separated for multiple. Example: `6VXX` or `6VXX,7BZ5` |
| Hash | `path` | Workspace file path. Mutually exclusive with `accession`. Example: `/user/home/file.pdb` |

**`accession` vs `path` logic (source):**
```javascript
// ProteinStructure.js:57
this.isWorkspace = (this.state.hashParams.path !== undefined);
// ProteinStructure.js:76
const accessionId = this.state.hashParams.accession || this.viewDefaults.get('accession');
```

---

### Surveillance

**Viewer file:** `public/js/p3/widget/viewer/Surveillance.js`

**URL pattern:**
```
/view/Surveillance/{sample_identifier}?{query_string}#{hash_params}
```

**Examples:**
```
/view/Surveillance/ISDN123456?pathogen_test_type=Influenza%20A
/view/Surveillance/ISDN123456#view_tab=overview
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Path segment | `sample_identifier` | Surveillance sample ID (stored internally as `eid`) |
| Query string | `pathogen_test_type` | Pathogen test type filter. URL-encoded value. Converted to `eq(pathogen_test_type,{value})` in API call |
| Hash | `view_tab` | Active tab name. Default: `overview` |

**Query string conversion (source):**
```javascript
// Surveillance.js (postCreate)
let q = `?eq(sample_identifier,${this.eid})`;
if (this.query) {
  this.query.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) {
      q += `&eq(${key},${value})`; // pathogen_test_type=Foo → eq(pathogen_test_type,Foo)
    }
  });
}
```

**URL generated by `GridContainer.js:805`:**
```javascript
href: `/view/Surveillance/${sel.sample_identifier}?pathogen_test_type=${encodeURIComponent(sel.pathogen_test_type)}`
```

---

### Serology

**Viewer file:** `public/js/p3/widget/viewer/Serology.js`

**URL pattern:**
```
/view/Serology/{sample_identifier}?{query_string}#{hash_params}
```

**Examples:**
```
/view/Serology/ISDN789012?test_type=HI
/view/Serology/ISDN789012#view_tab=overview
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Path segment | `sample_identifier` | Serology sample ID (stored internally as `eid`) |
| Query string | `test_type` | Serological test type filter. URL-encoded. Converted to `eq(test_type,{value})` in API call |
| Hash | `view_tab` | Active tab name. Default: `overview` |

**URL generated by `GridContainer.js:905`:**
```javascript
href: `/view/Serology/${sel.sample_identifier}?test_type=${encodeURIComponent(sel.test_type)}`
```

---

### ExperimentComparison (user-facing: "Experiments" singular)

**Viewer file:** `public/js/p3/widget/viewer/ExperimentComparison.js`

**URL pattern:**
```
/view/ExperimentComparison/{experiment_id}#{hash_params}
```

**Examples:**
```
/view/ExperimentComparison/2000000#view_tab=overview
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Path segment | `experiment_id` | Experiment ID (positive digit string; textual representation is preserved) |
| Hash | `view_tab` | Active tab name. Default: `overview` |

The canonical routes are `/experiment/{experimentId}` and `/experiment/{experimentId}?tab=biosets`. Biosets remain scoped to their Experiment member and do not have a top-level canonical route.

> **Note:** The viewer file is `Experiment.js` in legacy BV-BRC, but the URL segment is `ExperimentComparison`, not `Experiment`. The bare `Experiment` viewer (workspace-only) has no public URL.

---

## List Viewers

These display grids of multiple records filtered by an RQL query in the query string.

**Common pattern for all list viewers:**
```
/view/{ViewType}/?{RQL_expression}#{hash_params}
```
The `?` query string is parsed as `state.search` and passed directly to the data API as an RQL filter.

---

### TaxonList

**Viewer file:** `public/js/p3/widget/viewer/TaxonList.js`

**URL pattern:**
```
/view/TaxonList/?{RQL}#{hash_params}
```

**Examples:**
```
/view/TaxonList/?eq(taxon_lineage_ids,1763)#view_tab=taxons
/view/TaxonList/?and(eq(taxon_lineage_ids,1763),gt(genomes,0))
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Query string | _(RQL expression)_ | Unnamed. Full RQL filter against `taxonomy` endpoint. Example: `eq(taxon_lineage_ids,1763)` |
| Hash | `view_tab` | Active tab name. Default: `taxons` |
| Hash | `filter` | RQL condition. Set/cleared via `onSetAnchor`. |

---

### GenomeList

**Viewer file:** `public/js/p3/widget/viewer/GenomeList.js`

**URL pattern:**
```
/view/GenomeList/?{RQL}#{hash_params}
```

**Examples:**
```
/view/GenomeList/?eq(taxon_lineage_ids,1763)#view_tab=genomes
/view/GenomeList/?eq(public,false)
/view/GenomeList/?eq(taxon_lineage_ids,1763)#view_tab=genomes&filter=false
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Query string | _(RQL expression)_ | Unnamed. Full RQL filter against `genome` endpoint |
| Hash | `view_tab` | Active tab name. Default: `genomes` |
| Hash | `filter` | RQL condition or `false`. Set/cleared via `onSetAnchor`. |

---

### FeatureList

**Viewer file:** `public/js/p3/widget/viewer/FeatureList.js` → `_FeatureList.js`

**URL pattern:**
```
/view/FeatureList/?{RQL}[&filter="{filter_value}"]#{hash_params}
```

**Examples:**
```
/view/FeatureList/?eq(genome_id,83332.12)#view_tab=overview
/view/FeatureList/?eq(genome_id,83332.12)&filter="CDS"
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Query string | _(RQL expression)_ | Unnamed. Full RQL filter against features endpoint |
| Query string | `filter` | **Named param within query string** (not hash). Parsed via `URLSearchParams`. Sets the grid's default feature type filter. Value is URL-encoded. Example: `filter="CDS"` |
| Hash | `view_tab` | Active tab name. Default: `overview` |

**`filter` query string parsing (source):**
```javascript
// _FeatureList.js:142-151
if (this.state && this.state.search) {
  const params = new URLSearchParams(this.state.search);
  let filter = params.get('filter');
  if (filter) {
    featureGridOptions.defaultFilter = filter.replace(/^"|"$/g, '');
    // Remove filter from search before passing to API
    this.state.search = this.state.search.replace(/filter="[^"]*"&/, '');
  }
}
```

> **Note:** `filter` is a **query string** param for FeatureList, not a hash param. This differs from Taxonomy/Genome/GenomeList where `filter` is a hash param.

---

### StrainList

**Viewer file:** `public/js/p3/widget/viewer/StrainList.js`

**URL pattern:**
```
/view/StrainList/?{RQL}#{hash_params}
```

**Examples:**
```
/view/StrainList/?eq(strain,"H1N1")#view_tab=strain
/view/StrainList/?eq(taxon_id,11520)
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Query string | _(RQL expression)_ | Unnamed. Full RQL filter against `strain` endpoint |
| Hash | `view_tab` | Active tab name. Default: `strain` |

---

### DomainAndMotifList (actual URL: DomainsAndMotifsList)

**Viewer file:** `public/js/p3/widget/viewer/DomainsAndMotifsList.js`

> **Important:** The actual URL segment is `DomainsAndMotifsList`, not `DomainAndMotifList`.

**URL pattern:**
```
/view/DomainsAndMotifsList/?{RQL}#{hash_params}
```

**Examples:**
```
/view/DomainsAndMotifsList/?eq(genome_id,83332.12)#view_tab=proteinFeatures
/view/DomainsAndMotifsList/?and(eq(taxon_lineage_ids,1763),eq(feature_type,Domain))
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Query string | _(RQL expression)_ | Unnamed. Full RQL filter against `protein_feature` endpoint |
| Hash | `view_tab` | Active tab name. Default: `proteinFeatures` |

---

### EpitopeList

**Viewer file:** `public/js/p3/widget/viewer/EpitopeList.js`

**URL pattern:**
```
/view/EpitopeList/?{RQL}#{hash_params}
```

**Examples:**
```
/view/EpitopeList/?eq(taxon_id,11520)#view_tab=epitope
/view/EpitopeList/?eq(host_name,"Homo sapiens")
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Query string | _(RQL expression)_ | Unnamed. Full RQL filter against `epitope` endpoint |
| Hash | `view_tab` | Active tab name. Default: `epitope` |

---

### ProteinStructureList

**Viewer file:** `public/js/p3/widget/viewer/ProteinStructureList.js`

**URL pattern:**
```
/view/ProteinStructureList/?{RQL}#{hash_params}
```

**Examples:**
```
/view/ProteinStructureList/?eq(taxon_id,1763)#view_tab=structures
/view/ProteinStructureList/?eq(genome_id,83332.12)
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Query string | _(RQL expression)_ | Unnamed. Full RQL filter against `protein_structure` endpoint |
| Hash | `view_tab` | Active tab name. Default: `structures` |

---

### SurveillanceList

**Viewer file:** `public/js/p3/widget/viewer/SurveillanceList.js`

**URL pattern:**
```
/view/SurveillanceList/?{RQL}#{hash_params}
```

**Examples:**
```
/view/SurveillanceList/?eq(taxon_id,11520)#view_tab=surveillance
/view/SurveillanceList/?eq(collection_country,"USA")
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Query string | _(RQL expression)_ | Unnamed. Full RQL filter against `surveillance` endpoint |
| Hash | `view_tab` | Active tab name. Default: `surveillance` |

---

### SerologyList

**Viewer file:** `public/js/p3/widget/viewer/SerologyList.js`

**URL pattern:**
```
/view/SerologyList/?{RQL}#{hash_params}
```

**Examples:**
```
/view/SerologyList/?eq(taxon_id,11520)#view_tab=serology
/view/SerologyList/?eq(host_species,"Homo sapiens")
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Query string | _(RQL expression)_ | Unnamed. Full RQL filter against `serology` endpoint |
| Hash | `view_tab` | Active tab name. Default: `serology` |

---

### ExperimentList

**Viewer file:** `public/js/p3/widget/viewer/ExperimentList.js`

**URL pattern:**
```
/view/ExperimentList/?{RQL}#{hash_params}
```

**Examples:**
```
/view/ExperimentList/?eq(taxon_id,1763)#view_tab=experiments
/view/ExperimentList/?eq(organism,"Mycobacterium tuberculosis")
```

**Parameter keys:**

| Location | Key | Description |
|---|---|---|
| Query string | _(RQL expression)_ | Unnamed. Full RQL filter against `experiment` endpoint |
| Hash | `view_tab` | Active tab name. Default: `experiments` |

---

## Views That Do Not Exist

| User-facing Name | Status | Use Instead |
|---|---|---|
| `Strain` (singular) | No `Strain.js` viewer file | `StrainList` |
| `DomainAndMotifs` (singular) | No singular viewer | `DomainsAndMotifsList` |

---

## Complete Unique Parameter Key Reference

All unique parameter keys across all 20 views:

### Path Segment Keys (entity IDs)

| Key | Views |
|---|---|
| `taxon_id` / `taxon_name` | Taxonomy |
| `genome_id` | Genome |
| `feature_id` | Feature |
| `epitope_id` (as `eid`) | Epitope |
| `sample_identifier` (as `eid`) | Surveillance, Serology |

### Query String Keys

| Key | Views | Notes |
|---|---|---|
| _(RQL expression, unnamed)_ | All List views | Raw RQL; no key name; entire `?...` is the filter |
| `pathogen_test_type` | Surveillance | Named param; converted to `eq(pathogen_test_type,{val})` |
| `test_type` | Serology | Named param; converted to `eq(test_type,{val})` |
| `filter` | FeatureList | Named param within query string; parsed via `URLSearchParams`; sets grid default filter |

### Hash Param Keys

| Key | Views | Notes |
|---|---|---|
| `view_tab` | All tab-based viewers | Selects active tab by name |
| `filter` | Taxonomy, TaxonList, Genome, GenomeList | RQL condition string or `false` to clear; **different from FeatureList's `filter`** |
| `accession` | ProteinStructure | PDB accession ID(s), comma-separated |
| `path` | ProteinStructure | Workspace file path; mutually exclusive with `accession` |

---

## Key Sources

| File | Role |
|---|---|
| `public/js/p3/app/p3app.js` | Route registration and URL parsing (`getState`, `/view(/.*) ` handler) |
| `public/js/p3/widget/viewer/TabViewerBase.js` | Base class; `view_tab` hash param handling |
| `public/js/p3/widget/viewer/Taxonomy.js` | Taxonomy viewer; `filter` hash param |
| `public/js/p3/widget/viewer/Genome.js` | Genome viewer; `filter` hash param for host genomes |
| `public/js/p3/widget/viewer/_FeatureList.js` | FeatureList base; `filter` query string param via `URLSearchParams` |
| `public/js/p3/widget/viewer/ProteinStructure.js` | `accession` and `path` hash params |
| `public/js/p3/widget/viewer/Surveillance.js` | `pathogen_test_type` query string param |
| `public/js/p3/widget/viewer/Serology.js` | `test_type` query string param |
| `public/js/p3/widget/GridContainer.js` | Generates Surveillance/Serology URLs with named query params |
