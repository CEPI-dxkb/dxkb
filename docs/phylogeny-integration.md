# Phylogeny integration

DXKB's taxonomy Phylogeny view supports two renderers. Archaeopteryx renders phyloXML directly in the application. Auspice is built as a separate same-origin client and runs in an iframe at `/nextstrain-viewer/<dataset-id>`.

## Data flow

Bacterial trees: the browser asks `/api/phylogeny/bacterial-trees/<taxonId>` for the taxon's phyloXML filename, then downloads that file from BV-BRC itself. The route answers from `src/lib/phylogeny/bacterial-tree-index.ts`, which downloads BV-BRC's `taxon_tree_dict.json` (~32 MB; 499,508 taxa mapped to 2,900 files) once per server process and refreshes it in the background after 24 h. The browser used to download that dictionary itself under a 2 s timeout, which failed on connections slower than ~17 Mbit/s. `PHYLO_TREE_DICTIONARY_URL` overrides the source; E2E points it at the loopback mock.

Viral family JSON advertises Archaeopteryx and Nextstrain choices. Advertised Nextstrain choices are enabled when `/api/phylogeny/nextstrain-datasets` confirms that the corresponding BV-BRC dataset exists, or when an optional local fallback contains a renderable copy. Inventory loading or failure is shown separately from confirmed dataset absence.

Auspice calls the local Charon-compatible routes under `/api/charon`, which fetch from BV-BRC first and fall back to the optional local store when the remote dataset is missing or unavailable. Dataset IDs are canonical slash-separated identifiers; main files in the fallback directory use the same segments joined by underscores and a `.json` suffix. Sidecars use the supported `_tip-frequencies`, `_root-sequence`, and `_measurements` suffixes. Because those suffixes are indistinguishable from a real final ID segment of the same name, `tip-frequencies`, `root-sequence`, and `measurements` are reserved and rejected as a dataset ID's final segment (`parseDatasetId`/`canonicalDatasetId`) — a main dataset must not be named after a sidecar.

## Archaeopteryx

`src/lib/phylogeny/archaeopteryx.ts` lazy-loads Archaeopteryx.js 3.28 with d3 v7, `archaeopteryx/forester` and phyloxml, publishing each on `window` first: the bundler cannot resolve the guarded `require()` calls in the library's UMD header, so the bundled viewer reads its dependencies from page globals. PNG and PDF entries in the Download menu (opened by its Download… button) appear only when `window.Canvg` (canvg 4) and `window.jspdf` with svg2pdf.js are present, so the loader publishes those too. jQuery, jQuery UI and FileSaver are no longer used.

- `launch(container, tree, config)` takes one config object and throws on any unknown key. `createViewerConfig` is the only place DXKB builds it, and its unit tests launch the real viewer with it. Bacterial trees enable leaf selection; viral trees open on the `Host` visualization, which the viewer replaces with its own choice (logging a warning) when too few tips carry it.
- No custom node-label config is passed. Archaeopteryx 3.25 retired `nodeLabels` (3.28 still accepts it with a console warning, and it is slated to throw), so DXKB no longer builds label checkboxes: the viewer's own Metadata checkbox and "Metadata fields…" chooser offer the tree's own properties. Upstream escapes tooltip, dialog, menu and panel text itself, and the real-viewer unit tests pin that names render as text. A launch-config test fails if the viewer logs a deprecation warning.
- The viewer keeps one instance per page in module state, and every handle's `destroy()` tears down whichever viewer is current. `mountArchaeopteryx` makes a replaced handle's `destroy()` a no-op.
- Theme: 3.x has no background or label color options. `seedViewerTheme` writes the site's light/dark choice to `localStorage["aptx-panel-theme"]` before launch; `syncViewerTheme` clicks the viewer's own theme switch (hidden in `src/styles/archaeopteryx-theme.css`) when `data-theme` changes, which keeps zoom, selection and searches. The same stylesheet maps the viewer's `--p-*` custom properties and the canvas background to DXKB tokens.
- Control panel: `ArchaeopteryxPhylogeny` launches it collapsed to its header bar when the tree host is 640px wide or less. It measures the host, not the viewport, because the leaf-details side panel can take up to 60% of a wide screen. When a resize takes the host across that width, `setViewerControlsCollapsed` clicks the viewer's own hide/show button. Narrowing folds the panel. Widening reopens it only if narrowing folded it, so a panel the user opened or closed in between stays as they left it.
- No local patch is applied. The retired `archaeopteryx@2.3.2` patch escaped tooltip, dialog, option and checkbox HTML; namespaced and removed its page listeners; added `destroy()` and `setTheme()`; and awaited canvg for PNG export. 3.x does all of that itself except the theme API, which the theme helpers above replace. phyloxml 1.1.x likewise ships the `require('sax')` fix the retired `phyloxml@1.0.0` patch carried.

## Deployment

`NEXTSTRAIN_DATASET_DIR` is optional. Leave it unset for the default remote-only configuration. Set it to an absolute, readable directory only when the deployment should use local datasets as a fallback for BV-BRC misses or outages. A configured but unreadable directory is treated as a deployment error.

When a local fallback is provisioned, run `pnpm check:nextstrain-datasets`. It reconciles family advertisements with the exact validation policy used by runtime inventory, including filename validity, sidecar exclusion, realpath containment, regular-file status, JSON parsing, and supported Auspice v2 shapes. Use `--strict` when missing advertised fallback datasets must fail a deployment gate; unadvertised valid local datasets remain warnings.

`pnpm build:auspice` creates `public/dist` and `public/nextstrain-viewer.html`. The build retains third-party `.LICENSE.txt` notices and removes only the copied `dist/index.html`; the Auspice patch drops the gzip/brotli compression plugins, since those copies were never served. Its content hash covers the build script, Auspice config/navbar, package metadata, lockfile, and Auspice patches. Clean CI requires restored output or a cache keyed by those inputs before the local skip can save work.

Standalone deployments must include `public/dist`, `public/nextstrain-viewer.html`, `public/auspice-dark.css`, and `public/auspice-favicon.png`.

### Auspice map

The build uses `auspice@3.2.0`. Auspice 3 draws the map with MapLibre GL inside Leaflet, from a MapLibre style document, and the 2.x `mapTiles.api` raster URL is no longer read. `auspice/config.json` sets no `mapTiles`, so the viewer uses Auspice's bundled style (`node_modules/auspice/src/util/map-styles.json`), served by OpenFreeMap: the browser fetches the TileJSON, vector tiles, glyphs and sprites from `https://tiles.openfreemap.org`, and MapLibre runs in a same-origin module worker loaded from `/dist/<hash>.mjs`. DXKB sends no Content-Security-Policy on `/nextstrain-viewer/*`; adding one later must allow that host in `connect-src`/`img-src` and `'self'` in `worker-src`.

Auspice 3.2.0 declares `maplibre-gl@^4.7.1`, and `pnpm-workspace.yaml` overrides it to 6.x for GHSA-jrc7-96c5-q579 (an attribution XSS fixed only in 6.4.1). MapLibre 6 ships only ES modules and finds its worker beside its own module through `import.meta.url`, which webpack rewrites to a `file://` URL, so on its own it starts no worker and draws no tiles. The Auspice patch therefore calls `setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href)` in `src/components/map/map.js`, which makes webpack emit the worker as a hashed asset; `e2e/tests/organisms/auspice.spec.ts` checks that the worker starts from it.

Auspice parses dropped metadata files (CSV, TSV, Excel) with SheetJS. The npm `xlsx` package stopped at 0.18.5, and the prototype-pollution fix (GHSA-4r6h-8v6p-xvw6, >= 0.19.3) is published only on the SheetJS CDN. pnpm's `blockExoticSubdeps` refuses a tarball URL below the root, so `pnpm-workspace.yaml` removes Auspice's `xlsx` dependency (`"-"`), the root `package.json` declares `xlsx` from `https://cdn.sheetjs.com`, and webpack resolves Auspice's import from the root `node_modules`. That release exports its mini build only as `xlsx/dist/xlsx.mini.min`, so the patch imports that path in `src/actions/filesDropped/parseCsv.ts`.

`patches/auspice@3.2.0.patch` sets css-loader `esModule: false` in Auspice's `webpack.config.cjs`. The repo pins css-loader 7.1.4 through a pnpm override, and its ES-module output is unreadable by Auspice's bundled style-loader 0.13.2, so without the patch none of Auspice's CSS (Leaflet, MapLibre, global styles) reached the page: map dots sat far from their places and the zoom buttons and attribution fell to the bottom of an oversized map box. The theme bridge appends `system-ui, sans-serif` to the host's `--font-geist-sans` (`--dxkb-font`), because Geist is not loaded in the iframe and `Geist Fallback` is a next/font name, so a bare stack fell back to the browser's serif default.

The build is expected to run without warnings. Beyond the fixes above, the Auspice patch removes the compression plugins (compression-webpack-plugin 3 raises webpack 5's `DEP_WEBPACK_COMPILATION_ASSETS` deprecation), sets babel-loader `compact: true` (terser minifies the output anyway; this silences Babel's "deoptimised the styling" note on lodash and react-icons), turns off webpack's asset-size hints, and ignores MapLibre 6's "Critical dependency" warning for `new URL(<expression>, import.meta.url)`, a path `setWorkerUrl` makes unused. `patches/babel-plugin-lodash@3.3.4.patch` replaces the deprecated `isModuleDeclaration` call with `isImportOrExportDeclaration`, which removed a stack trace printed on every build.

The 2.x build used CARTO's keyless Voyager raster tiles. Every keyless `basemaps.cartocdn.com` tile now answers 200 with an "API KEY REQUIRED" placeholder image, so the old look cannot be kept without a CARTO account. With a key, the tiles can return as a MapLibre raster style in `mapTiles.style` (`"type": "raster"`, the four `{a-d}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png` URLs, `"tileSize": 256`), the key in `mapTiles.accessToken` and the `<ACCESS_TOKEN>` placeholder in the URLs.

`mapTiles` replaces Auspice's defaults wholesale. Its `attribution` field is not shown: `@maplibre/maplibre-gl-leaflet` builds the credit from the style's sources once the style loads. A custom style must carry the credit as an `attribution` on its source (OpenFreeMap's TileJSON already does). `public/auspice-dark.css` inverts the map for dark themes through `.leaflet-tile-pane`, which holds the MapLibre canvas.

E2E specs stub the OpenFreeMap host with `mockAuspiceBasemap` (`e2e/fixtures/overrides/auspice-basemap.ts`).

## Licensing and attribution

Auspice is AGPL-3.0. Releases must provide the corresponding Auspice source and DXKB build-time customizations as required by that license. Complete this source-availability review as a release requirement rather than assuming npm package availability alone is sufficient.

Keep the visible "Powered by Nextstrain" attribution and the map's OpenFreeMap/OpenMapTiles/OpenStreetMap attribution. Retain generated third-party license notices unless legal review approves another distribution mechanism.

## References

- `src/lib/phylogeny/archaeopteryx.ts`: Archaeopteryx loader, launch config, theme sync and control-panel collapse
- `src/lib/phylogeny/bacterial-tree-index.ts`: server-side taxon → bacterial tree filename index
- `src/lib/phylogeny/dataset-inventory.ts`: shared renderability policy
- `src/lib/phylogeny/dataset-store.ts`: runtime inventory cache and exact reads
- `scripts/check-nextstrain-datasets.ts`: deployment reconciliation
- `scripts/build-auspice.mjs`: client build and packaging
- `docs/bvbrc-auspice-nextstrain-integration.md`: dated legacy BV-BRC behavior and curated-data rationale
