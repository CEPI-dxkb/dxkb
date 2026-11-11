import type { Page } from "@playwright/test";
import { awaitSettled, type SettleOptions } from "./settle";

/**
 * Runs after awaitSettled(); for page-specific readiness only. A redirect
 * entry should end on observable readiness (re-call awaitSettled with a
 * skeletonSelector), and an entry with loadState "domcontentloaded" must not
 * wait for networkidle, which never opens there.
 */
export type PrepareHook = (page: Page) => Promise<void>;

interface RouteVariant {
  nameSuffix: string;
  path: string;
  /** Runs after the parent entry's `prepare`, not instead of it. */
  prepare?: PrepareHook;
}

export interface RouteEntry {
  name: string;
  path: string;
  /**
   * Every page.tsx this entry covers, relative to `src/app/`; the only
   * coverage list, diffed against disk by `coverage.meta.spec.ts`.
   */
  pages: string[];
  unauthenticated?: boolean;
  redirectOnly?: boolean;
  needsWorkspace?: boolean;
  needsJobs?: boolean;
  needsCopilot?: boolean;
  tripwire?: boolean;
  mobile?: boolean;
  variants?: RouteVariant[];
  /**
   * Forwarded to awaitSettled(); use loadState "domcontentloaded" on pages
   * whose RSC prefetch never lets networkidle settle.
   */
  settle?: SettleOptions;
  prepare?: PrepareHook;
}

const e2eUsername = "e2e-test-user@patricbrc.org";

export const routes: RouteEntry[] = [
  {
    name: "home",
    path: "/",
    pages: ["page.tsx"],
    unauthenticated: true,
    tripwire: true,
    mobile: true,
  },

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
    // Rolling RSC prefetch tokens keep networkidle from ever settling on this
    // page.
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

  {
    name: "search",
    path: "/search",
    pages: ["search/page.tsx"],
    unauthenticated: true,
    tripwire: true,
    mobile: true,
    // Both states come from `search/page.tsx` branches, so they are variants
    // (coverage allows one entry per page.tsx).
    variants: [
      { nameSuffix: "default", path: "/search" },
      {
        nameSuffix: "unsupported-type",
        path: "/search?type=pathway&q=influenza",
      },
    ],
  },

  {
    name: "advanced-search",
    path: "/advanced-search/genomes",
    pages: ["advanced-search/[type]/page.tsx"],
    unauthenticated: true,
  },

  {
    name: "taxonomy",
    path: "/taxonomy/234",
    pages: ["(views)/taxonomy/[taxonId]/page.tsx"],
    unauthenticated: true,
    mobile: true,
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
    name: "strain",
    path: "/strain/strain-backend-901",
    pages: ["(views)/strain/[strainId]/page.tsx"],
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

  {
    name: "jobs",
    path: "/jobs",
    pages: ["jobs/page.tsx"],
    needsJobs: true,
    tripwire: true,
  },

  {
    name: "copilot",
    path: "/copilot",
    pages: ["copilot/page.tsx"],
    needsCopilot: true,
  },

  {
    name: "settings",
    path: "/settings",
    pages: ["settings/page.tsx"],
  },

  {
    name: "services",
    path: "/services",
    pages: ["services/page.tsx"],
    tripwire: true,
    mobile: true,
  },

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

  {
    name: "viral-genome-tree",
    path: "/services/viral-genome-tree",
    pages: ["services/(phylogenomics)/viral-genome-tree/page.tsx"],
  },

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

  {
    name: "fastq-utilities",
    path: "/services/fastq-utilities",
    pages: ["services/(utilities)/fastq-utilities/page.tsx"],
  },

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

  // /workspace redirects to /workspace/<user>/home; this one scan accounts
  // for all three page files.
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
      // settle runs before prepare, so re-settle on the redirect destination:
      // the file listing renders skeleton rows, and the details panel
      // collapses from a client effect that leaves a role="separator" without
      // aria-valuenow (see awaitPanelLayoutCommitted).
      await awaitSettled(page, { skeletonSelector: '[data-slot="skeleton"]' });
    },
  },
  {
    name: "workspace-public",
    path: "/workspace/public",
    pages: ["workspace/public/page.tsx"],
  },
  {
    name: "workspace-public-user",
    path: `/workspace/public/${e2eUsername}`,
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
    prepare: async (page) => {
      await page.waitForURL(/\/workspace\/public\/ARWattam@patricbrc\.org\//, {
        timeout: 10_000,
      });
      await awaitSettled(page, { skeletonSelector: '[data-slot="skeleton"]' });
    },
  },

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

  {
    name: "structure-viewer",
    path: "/viewer/structure",
    pages: ["viewer/structure/[[...path]]/page.tsx"],
  },
];

/**
 * Every src/app page.tsx accounted for by the route table; edit an entry's
 * `pages`, not a second list.
 */
export const coveredPageFiles: ReadonlySet<string> = new Set(
  routes.flatMap((route) => route.pages),
);

export interface ScanTarget {
  route: RouteEntry;
  name: string;
  path: string;
  prepare?: PrepareHook;
}

/**
 * Runs the parent hook, then the variant's, with the same argument; either
 * may be absent.
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
 * Flatten routes x variants into scan targets, skipping redirect-only
 * entries; a parent's `prepare` is composed into each variant's.
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
