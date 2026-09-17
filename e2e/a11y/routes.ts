import type { Page } from "@playwright/test";
import type { SettleOptions } from "./settle";

/**
 * Route-specific readiness hook, run AFTER awaitSettled().
 *
 * Reserve these for *observable, page-specific* readiness — an element that must
 * exist before axe scans, or a redirect that must have landed. Generic readiness
 * (load state, fonts, skeleton detach) belongs in `settle` / `awaitSettled()`;
 * a bare `waitForLoadState("networkidle")` here is always redundant because
 * awaitSettled() has already awaited it.
 */
export type PrepareHook = (page: Page) => Promise<void>;

interface RouteVariant {
  /** Appended to parent name: e.g. "brucella" → scanned as "taxonomy/brucella". */
  nameSuffix: string;
  path: string;
  /**
   * Variant-specific readiness. Runs AFTER the parent entry's `prepare`, not
   * instead of it — put anything true of every variant on the parent.
   */
  prepare?: PrepareHook;
}

export interface RouteEntry {
  /** Unique name — baseline key (route dimension). */
  name: string;
  /** URL path to navigate to. */
  path: string;
  /**
   * Every page.tsx file this entry accounts for, relative to `src/app/`.
   *
   * This is the ONLY coverage list: `coveredPageFiles` is derived from it and
   * `coverage.meta.spec.ts` diffs that against the files on disk in both
   * directions. Most entries name exactly one file; name more when one scan
   * genuinely covers several (a redirect target, or the same component mounted
   * under a different segment). Required, so a new entry cannot skip accounting.
   */
  pages: string[];
  /** Skip auth cookies + use unauthenticated session override. Default: false. */
  unauthenticated?: boolean;
  /**
   * Always redirects — counted in meta-test accounting but NOT scanned.
   * The redirect target must be covered by another entry in this table.
   */
  redirectOnly?: boolean;
  /** Add workspace RPC overrides to mock stack. */
  needsWorkspace?: boolean;
  /** Add jobs overrides to mock stack. */
  needsJobs?: boolean;
  /** Include in webkit/firefox thin tripwire project. */
  tripwire?: boolean;
  /** Include in mobile-thin project (375px viewport). */
  mobile?: boolean;
  /** Variants for dynamic routes — one scan per variant. */
  variants?: RouteVariant[];
  /**
   * Options forwarded to awaitSettled(). Use loadState: "domcontentloaded" for
   * pages with continuous Next.js RSC prefetch cycles that prevent networkidle.
   */
  settle?: SettleOptions;
  /** Observable page-specific readiness. See {@link PrepareHook}. */
  prepare?: PrepareHook;
}

// e2e test username — matches auth cookie values set in backends.ts
const e2eUsername = "e2e-test-user@patricbrc.org";

export const routes: RouteEntry[] = [
  // ── Public / home ────────────────────────────────────────────────────────────
  {
    name: "home",
    path: "/",
    pages: ["page.tsx"],
    unauthenticated: true,
    tripwire: true,
    mobile: true,
  },

  // ── Auth pages ────────────────────────────────────────────────────────────────
  {
    name: "sign-in",
    path: "/sign-in",
    pages: ["(auth)/sign-in/page.tsx"],
    unauthenticated: true,
    tripwire: true,
    prepare: async (page) => {
      await page
        .getByRole("button", { name: /sign in/i })
        .waitFor({ state: "visible" });
    },
  },
  {
    name: "sign-up",
    path: "/sign-up",
    pages: ["(auth)/sign-up/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "forgot-password",
    path: "/forgot-password",
    pages: ["(auth)/forgot-password/page.tsx"],
    unauthenticated: true,
  },

  // ── Footer / static pages (unauthenticated) ─────────────────────────────────
  {
    name: "about",
    path: "/about",
    pages: ["(footer)/about/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "citations",
    path: "/citations",
    pages: ["(footer)/citations/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "contact",
    path: "/contact",
    pages: ["(footer)/contact/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "faq",
    path: "/faq",
    pages: ["(footer)/faq/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "funding",
    path: "/funding",
    pages: ["(footer)/funding/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "help",
    path: "/help",
    pages: ["(footer)/help/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "news",
    path: "/news",
    pages: ["(footer)/news/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "privacy-policy",
    path: "/privacy-policy",
    pages: ["(footer)/privacy-policy/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "publications",
    path: "/publications",
    pages: ["(footer)/publications/page.tsx"],
    unauthenticated: true,
    // Next.js prefetches all <Link> elements continuously with rolling RSC tokens,
    // preventing networkidle from ever opening a 500ms quiet window on this page.
    settle: { loadState: "domcontentloaded" },
  },
  {
    name: "related-resources",
    path: "/related-resources",
    pages: ["(footer)/related-resources/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "team",
    path: "/team",
    pages: ["(footer)/team/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "updates",
    path: "/updates",
    pages: ["(footer)/updates/page.tsx"],
    unauthenticated: true,
  },

  // ── Organism landing pages ────────────────────────────────────────────────────
  {
    name: "organisms-all",
    path: "/organisms/all",
    pages: ["organisms/all/page.tsx"],
    unauthenticated: true,
    tripwire: true,
    mobile: true,
  },
  {
    name: "organisms-bacteria",
    path: "/organisms/bacteria",
    pages: ["organisms/bacteria/page.tsx"],
    unauthenticated: true,
    mobile: true,
  },
  {
    name: "organisms-viruses",
    path: "/organisms/viruses",
    pages: ["organisms/viruses/page.tsx"],
    unauthenticated: true,
    mobile: true,
  },

  // ── Search ───────────────────────────────────────────────────────────────────
  {
    name: "search",
    path: "/search",
    pages: ["search/page.tsx"],
    unauthenticated: true,
    tripwire: true,
    mobile: true,
    // Two states of the same page, both produced by `search/page.tsx`'s own
    // branch table rather than by a different route: the Overview prompt (no
    // params) and the explicit "no search view for this type" panel. They are
    // variants instead of separate entries because coverage accounting allows a
    // `page.tsx` exactly one owning entry.
    variants: [
      { nameSuffix: "default", path: "/search" },
      {
        nameSuffix: "unsupported-type",
        path: "/search?type=pathway&q=influenza",
      },
    ],
  },

  // ── Taxonomy (dynamic — two variants for multi-param coverage) ───────────────
  // Both variants are bacterial genera — 234 is Brucella, 1763 is
  // Mycobacterium — so they are named for those taxa. They were previously
  // "virus" and "bacteria", which named neither taxon correctly, and the 1763
  // scan reached the framework error boundary because the loopback mock had no
  // taxonomy fixture for that taxon (a fixture gap recorded in
  // baseline.generated.ts as if it were a page defect). Both now render the
  // real landing page, so the Metadata Distributions readiness signal is true
  // of every variant and belongs on the parent.
  {
    name: "taxonomy",
    path: "/taxonomy/234",
    pages: ["(views)/taxonomy/[taxonId]/page.tsx"],
    unauthenticated: true,
    mobile: true,
    // The section's <h2> renders synchronously; chart cards stream in after.
    prepare: async (page) => {
      await page
        .getByTestId("metadata-distributions")
        .waitFor({ timeout: 10_000 });
    },
    variants: [
      { nameSuffix: "brucella", path: "/taxonomy/234" },
      { nameSuffix: "mycobacterium", path: "/taxonomy/1763" },
    ],
  },

  // ── Views — list pages ─────────────────────────────────────────────────────
  {
    name: "taxonomy-list",
    path: "/taxonomy",
    pages: ["(views)/taxonomy/page.tsx"],
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.getByRole("heading", { level: 1, name: "Taxa" }).waitFor();
      await page.getByRole("row", { name: /Select row 11520/ }).waitFor();
    },
  },
  {
    name: "genome-list",
    path: "/genome",
    pages: ["(views)/genome/page.tsx"],
    unauthenticated: true,
    mobile: true,
  },
  {
    name: "feature-list",
    path: "/feature",
    pages: ["(views)/feature/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "epitope-list",
    path: "/epitope",
    pages: ["(views)/epitope/page.tsx"],
    unauthenticated: true,
    mobile: true,
  },
  {
    name: "surveillance-list",
    path: "/surveillance?keyword=sentinel",
    pages: ["(views)/surveillance/page.tsx"],
    unauthenticated: true,
    mobile: true,
  },
  {
    name: "serology-list",
    path: "/serology?keyword=antibody",
    pages: ["(views)/serology/page.tsx"],
    unauthenticated: true,
    mobile: true,
  },
  {
    name: "strain-list",
    path: "/strain?keyword=influenza",
    pages: ["(views)/strain/page.tsx"],
    unauthenticated: true,
    mobile: true,
    settle: { loadState: "domcontentloaded" },
    prepare: async (page) => {
      await page
        .getByText(/results/)
        .first()
        .waitFor();
    },
  },
  {
    name: "domains-and-motifs",
    path: "/domains-and-motifs?keyword=domain",
    pages: ["(views)/domains-and-motifs/page.tsx"],
    unauthenticated: true,
    mobile: true,
    settle: { loadState: "domcontentloaded" },
    prepare: async (page) => {
      await page
        .getByText(/results/)
        .first()
        .waitFor();
    },
  },
  {
    name: "experiment",
    path: "/experiment?keyword=RNA",
    pages: ["(views)/experiment/page.tsx"],
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page
        .getByText(/results/)
        .first()
        .waitFor();
    },
    variants: [
      { nameSuffix: "experiments", path: "/experiment?keyword=RNA" },
      {
        nameSuffix: "biosets",
        path: "/experiment?keyword=influenza&tab=biosets",
      },
    ],
  },
  {
    name: "protein-structure",
    path: "/protein-structure?accession=AF-P12345-F1",
    pages: ["(views)/protein-structure/page.tsx"],
    unauthenticated: true,
    mobile: true,
    settle: { loadState: "domcontentloaded" },
    prepare: async (page) => {
      await page
        .getByRole("heading", { level: 1, name: "AF-P12345-F1" })
        .waitFor({ timeout: 10_000 });
      await page.getByTestId("molstar-container").waitFor({ timeout: 30_000 });
    },
  },

  // ── Views — singular pages ─────────────────────────────────────────────────
  {
    name: "genome",
    path: "/genome/1282460.2049",
    pages: ["(views)/genome/[genomeId]/page.tsx"],
    unauthenticated: true,
    mobile: true,
  },
  {
    name: "feature",
    path: "/feature/PATRIC.1282460.2049.JX869059.CDS.1.100.fwd",
    pages: ["(views)/feature/[featureId]/page.tsx"],
    unauthenticated: true,
  },
  {
    name: "epitope",
    path: "/epitope/15780",
    pages: ["(views)/epitope/[epitopeId]/page.tsx"],
    unauthenticated: true,
    mobile: true,
  },
  {
    name: "surveillance",
    path: "/surveillance/sample%2F1?pathogen_test_type=RAT%2Fantigen",
    pages: ["(views)/surveillance/[sampleId]/page.tsx"],
    unauthenticated: true,
    mobile: true,
  },
  {
    name: "serology",
    path: "/serology/000123?test_type=ELISA%2FIgG%20test",
    pages: ["(views)/serology/[sampleId]/page.tsx"],
    unauthenticated: true,
    mobile: true,
  },
  {
    name: "experiment-singular",
    path: "/experiment/2000000",
    pages: ["(views)/experiment/[experimentId]/page.tsx"],
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.getByRole("heading", { level: 1, name: "2000000" }).waitFor();
    },
    variants: [
      { nameSuffix: "overview", path: "/experiment/2000000" },
      { nameSuffix: "biosets", path: "/experiment/2000000?tab=biosets" },
    ],
  },

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  {
    name: "jobs",
    path: "/jobs",
    pages: ["jobs/page.tsx"],
    needsJobs: true,
    tripwire: true,
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  {
    name: "settings",
    path: "/settings",
    pages: ["settings/page.tsx"],
  },

  // ── Services index ───────────────────────────────────────────────────────────
  {
    name: "services",
    path: "/services",
    pages: ["services/page.tsx"],
    tripwire: true,
    mobile: true,
  },

  // ── Genomics service forms ───────────────────────────────────────────────────
  {
    name: "genome-assembly",
    path: "/services/genome-assembly",
    pages: ["services/(genomics)/genome-assembly/page.tsx"],
    tripwire: true,
  },
  {
    name: "genome-annotation",
    path: "/services/genome-annotation",
    pages: ["services/(genomics)/genome-annotation/page.tsx"],
  },
  {
    name: "genome-alignment",
    path: "/services/genome-alignment",
    pages: ["services/(genomics)/genome-alignment/page.tsx"],
  },
  {
    name: "blast",
    path: "/services/blast",
    pages: ["services/(genomics)/blast/page.tsx"],
  },
  {
    name: "primer-design",
    path: "/services/primer-design",
    pages: ["services/(genomics)/primer-design/page.tsx"],
  },
  {
    name: "similar-genome-finder",
    path: "/services/similar-genome-finder",
    pages: ["services/(genomics)/similar-genome-finder/page.tsx"],
  },
  {
    name: "variation-analysis",
    path: "/services/variation-analysis",
    pages: ["services/(genomics)/variation-analysis/page.tsx"],
  },

  // ── Metagenomics service forms ───────────────────────────────────────────────
  {
    name: "metagenomic-binning",
    path: "/services/metagenomic-binning",
    pages: ["services/(metagenomics)/metagenomic-binning/page.tsx"],
  },
  {
    name: "metagenomic-read-mapping",
    path: "/services/metagenomic-read-mapping",
    pages: ["services/(metagenomics)/metagenomic-read-mapping/page.tsx"],
  },
  {
    name: "taxonomic-classification",
    path: "/services/taxonomic-classification",
    pages: ["services/(metagenomics)/taxonomic-classification/page.tsx"],
  },

  // ── Phylogenomics service forms ──────────────────────────────────────────────
  {
    name: "viral-genome-tree",
    path: "/services/viral-genome-tree",
    pages: ["services/(phylogenomics)/viral-genome-tree/page.tsx"],
  },

  // ── Protein tools service forms ──────────────────────────────────────────────
  {
    name: "gene-protein-tree",
    path: "/services/gene-protein-tree",
    pages: ["services/(protein-tools)/gene-protein-tree/page.tsx"],
  },
  {
    name: "meta-cats",
    path: "/services/meta-cats",
    pages: ["services/(protein-tools)/meta-cats/page.tsx"],
  },
  {
    name: "msa-snp-analysis",
    path: "/services/msa-snp-analysis",
    pages: ["services/(protein-tools)/msa-snp-analysis/page.tsx"],
  },
  {
    name: "proteome-comparison",
    path: "/services/proteome-comparison",
    pages: ["services/(protein-tools)/proteome-comparison/page.tsx"],
  },

  // ── Utilities service forms ──────────────────────────────────────────────────
  {
    name: "fastq-utilities",
    path: "/services/fastq-utilities",
    pages: ["services/(utilities)/fastq-utilities/page.tsx"],
  },

  // ── Viral tools service forms ────────────────────────────────────────────────
  {
    name: "influenza-ha-subtype",
    path: "/services/influenza-ha-subtype",
    pages: ["services/(viral-tools)/influenza-ha-subtype/page.tsx"],
  },
  {
    name: "sars-cov2-genome-analysis",
    path: "/services/sars-cov2-genome-analysis",
    pages: ["services/(viral-tools)/sars-cov2-genome-analysis/page.tsx"],
  },
  {
    name: "sars-cov2-wastewater-analysis",
    path: "/services/sars-cov2-wastewater-analysis",
    pages: ["services/(viral-tools)/sars-cov2-wastewater-analysis/page.tsx"],
  },
  {
    name: "subspecies-classification",
    path: "/services/subspecies-classification",
    pages: ["services/(viral-tools)/subspecies-classification/page.tsx"],
  },
  {
    name: "viral-assembly",
    path: "/services/viral-assembly",
    pages: ["services/(viral-tools)/viral-assembly/page.tsx"],
  },

  // ── Workspace (authenticated) ────────────────────────────────────────────────
  // Navigating to /workspace triggers a server redirect to /workspace/username/home.
  // The prepare hook waits for the redirect so the scan runs on the workspace browser.
  // The redirect target and the sibling [folder] route render the same component off
  // a different root, so all three page files are accounted for by this one scan.
  {
    name: "workspace",
    path: "/workspace",
    pages: [
      "workspace/page.tsx",
      "workspace/[username]/home/[[...path]]/page.tsx",
      "workspace/[username]/[folder]/[[...path]]/page.tsx",
    ],
    needsWorkspace: true,
    tripwire: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForURL(/\/workspace\/[^/]+\/home/, { timeout: 10_000 });
      await page.getByPlaceholder(/search files/i).waitFor({ timeout: 10_000 });
    },
  },
  // Public workspace listing (no auth required to VIEW, but authenticated user sees their context)
  {
    name: "workspace-public",
    path: "/workspace/public",
    pages: ["workspace/public/page.tsx"],
  },
  {
    name: "workspace-public-user",
    path: `/workspace/public/${e2eUsername}`,
    // The [...path] route below it is the same component with a deeper segment.
    pages: [
      "workspace/public/[username]/page.tsx",
      "workspace/public/[username]/[...path]/page.tsx",
    ],
  },
  {
    name: "workspace-shared",
    path: "/workspace/shared",
    pages: ["workspace/shared/[[...path]]/page.tsx"],
    needsWorkspace: true,
  },
  {
    name: "workspace-workshop",
    path: "/workspace/workshop",
    pages: ["workspace/workshop/page.tsx"],
    needsWorkspace: true,
  },

  // Redirect-only workspace routes — not scanned, just counted for meta-test accounting.
  {
    name: "workspace-home-redirect",
    path: "/workspace/home",
    pages: ["workspace/home/[[...path]]/page.tsx"],
    redirectOnly: true,
  },
  {
    name: "workspace-username-redirect",
    path: `/workspace/${e2eUsername}`,
    pages: ["workspace/[username]/page.tsx"],
    redirectOnly: true,
  },

  // ── Structure viewer ─────────────────────────────────────────────────────────
  // Molstar 3D canvas is excluded from axe; the wrapper element must carry an accessible name.
  {
    name: "structure-viewer",
    path: "/viewer/structure",
    pages: ["viewer/structure/[[...path]]/page.tsx"],
  },
];

/**
 * Every src/app page.tsx path accounted for by the route table, derived from the
 * per-entry `pages` declarations. `coverage.meta.spec.ts` globs the real files and
 * diffs them against this set in both directions, so this is not a second list to
 * maintain — edit the owning route entry's `pages` instead.
 */
export const coveredPageFiles: ReadonlySet<string> = new Set(
  routes.flatMap((route) => route.pages),
);

export interface ScanTarget {
  /** Owning route entry — carries the mock/project flags for the scan. */
  route: RouteEntry;
  /** Baseline + reflowSkip key. Variants read `${route.name}/${nameSuffix}`. */
  name: string;
  path: string;
  prepare?: PrepareHook;
}

/**
 * Run the parent hook first, then the variant's, forwarding the same argument to
 * both. Either side may be absent, in which case the other is returned as-is.
 *
 * Generic in the argument so the ordering contract can be asserted without
 * launching a browser — `buildScanTargets` always instantiates it at `Page`.
 */
export function composePrepare<T>(
  parent: ((target: T) => Promise<void>) | undefined,
  variant: ((target: T) => Promise<void>) | undefined,
): ((target: T) => Promise<void>) | undefined {
  if (!parent) return variant;
  if (!variant) return parent;
  return async (target) => {
    await parent(target);
    await variant(target);
  };
}

/**
 * Flatten routes × variants into individual scan targets, skipping redirect-only
 * entries. A parent with variants is not scanned on its own — only its variants —
 * so its `prepare` is composed into each variant's rather than replaced by it.
 */
export function buildScanTargets(entries: readonly RouteEntry[]): ScanTarget[] {
  return entries.flatMap((route) => {
    if (route.redirectOnly) return [];
    if (!route.variants?.length) {
      return [
        { route, name: route.name, path: route.path, prepare: route.prepare },
      ];
    }
    return route.variants.map((variant) => ({
      route,
      name: `${route.name}/${variant.nameSuffix}`,
      path: variant.path,
      prepare: composePrepare(route.prepare, variant.prepare),
    }));
  });
}

export const scanTargets: ScanTarget[] = buildScanTargets(routes);
