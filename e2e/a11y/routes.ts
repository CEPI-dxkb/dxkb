import type { Page } from "@playwright/test";
import type { SettleOptions } from "./settle";

export interface RouteVariant {
  /** Appended to parent name: e.g. "virus" → scanned as "taxonomy/virus". */
  nameSuffix: string;
  path: string;
  prepare?: (page: Page) => Promise<void>;
}

export interface RouteEntry {
  /** Unique name — baseline key (route dimension). */
  name: string;
  /** URL path to navigate to. */
  path: string;
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
  /**
   * page.tsx paths (relative to src/app/) this entry covers via redirect or same-component.
   * Used by coverage.meta.spec.ts for full page.tsx accounting.
   */
  covers?: string[];
  /** Variants for dynamic routes — one scan per variant. */
  variants?: RouteVariant[];
  /**
   * Options forwarded to awaitSettled(). Use loadState: "domcontentloaded" for
   * pages with continuous Next.js RSC prefetch cycles that prevent networkidle.
   */
  settle?: SettleOptions;
  /**
   * Extra settle hook. Called AFTER awaitSettled() for route-specific waiting
   * (e.g. waitForURL after redirect, element waits for streamed content).
   */
  prepare?: (page: Page) => Promise<void>;
}

// e2e test username — matches auth cookie values set in backends.ts
const e2eUsername = "e2e-test-user@patricbrc.org";

export const routes: RouteEntry[] = [
  // ── Public / home ────────────────────────────────────────────────────────────
  {
    name: "home",
    path: "/",
    unauthenticated: true,
    tripwire: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Auth pages ────────────────────────────────────────────────────────────────
  {
    name: "sign-in",
    path: "/sign-in",
    unauthenticated: true,
    tripwire: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
      await page
        .getByRole("button", { name: /sign in/i })
        .waitFor({ state: "visible" });
    },
  },
  {
    name: "sign-up",
    path: "/sign-up",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "forgot-password",
    path: "/forgot-password",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Footer / static pages (unauthenticated) ─────────────────────────────────
  {
    name: "about",
    path: "/about",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "citations",
    path: "/citations",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "contact",
    path: "/contact",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "faq",
    path: "/faq",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "funding",
    path: "/funding",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "help",
    path: "/help",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "news",
    path: "/news",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "privacy-policy",
    path: "/privacy-policy",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "publications",
    path: "/publications",
    unauthenticated: true,
    // Next.js prefetches all <Link> elements continuously with rolling RSC tokens,
    // preventing networkidle from ever opening a 500ms quiet window on this page.
    settle: { loadState: "domcontentloaded" },
  },
  {
    name: "related-resources",
    path: "/related-resources",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "team",
    path: "/team",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "updates",
    path: "/updates",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Organism landing pages ────────────────────────────────────────────────────
  {
    name: "organisms-all",
    path: "/organisms/all",
    unauthenticated: true,
    tripwire: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "organisms-bacteria",
    path: "/organisms/bacteria",
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "organisms-viruses",
    path: "/organisms/viruses",
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Search ───────────────────────────────────────────────────────────────────
  {
    name: "search",
    path: "/search",
    unauthenticated: true,
    tripwire: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Taxonomy (dynamic — two variants for multi-param coverage) ───────────────
  {
    name: "taxonomy",
    path: "/taxonomy/234",
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      // The section's <h2> renders synchronously; chart cards stream in after.
      await page
        .getByRole("heading", { level: 2, name: /Metadata Distributions/ })
        .waitFor({ timeout: 10_000 })
        .catch(() => undefined);
      await page.waitForLoadState("networkidle");
    },
    variants: [
      {
        nameSuffix: "virus",
        path: "/taxonomy/234",
        prepare: async (page) => {
          await page.waitForLoadState("networkidle");
        },
      },
      {
        nameSuffix: "bacteria",
        path: "/taxonomy/1763",
        prepare: async (page) => {
          await page.waitForLoadState("networkidle");
        },
      },
    ],
  },

  // ── Views — list pages ─────────────────────────────────────────────────────
  {
    name: "taxonomy-list",
    path: "/taxonomy",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "genome-list",
    path: "/genome",
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "feature-list",
    path: "/feature",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "epitope-list",
    path: "/epitope",
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "surveillance-list",
    path: "/surveillance?keyword=sentinel",
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "serology-list",
    path: "/serology?keyword=antibody",
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "strain-list",
    path: "/strain?keyword=influenza",
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
    unauthenticated: true,
    mobile: true,
    variants: [
      { nameSuffix: "experiments", path: "/experiment?keyword=RNA" },
      {
        nameSuffix: "biosets",
        path: "/experiment?keyword=influenza&tab=biosets",
      },
    ],
    prepare: async (page) => {
      await page
        .getByText(/results/)
        .first()
        .waitFor();
    },
  },
  {
    name: "protein-structure",
    path: "/protein-structure?accession=AF-P12345-F1",
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
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "feature",
    path: "/feature/PATRIC.1282460.2049.JX869059.CDS.1.100.fwd",
    unauthenticated: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "epitope",
    path: "/epitope/15780",
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "surveillance",
    path: "/surveillance/sample%2F1?pathogen_test_type=RAT%2Fantigen",
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "serology",
    path: "/serology/000123?test_type=ELISA%2FIgG%20test",
    unauthenticated: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "experiment-singular",
    path: "/experiment/2000000",
    unauthenticated: true,
    mobile: true,
    variants: [
      { nameSuffix: "overview", path: "/experiment/2000000" },
      { nameSuffix: "biosets", path: "/experiment/2000000?tab=biosets" },
    ],
    prepare: async (page) => {
      await page.getByRole("heading", { level: 1, name: "2000000" }).waitFor();
    },
  },

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  {
    name: "jobs",
    path: "/jobs",
    needsJobs: true,
    tripwire: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  {
    name: "settings",
    path: "/settings",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Services index ───────────────────────────────────────────────────────────
  {
    name: "services",
    path: "/services",
    tripwire: true,
    mobile: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Genomics service forms ───────────────────────────────────────────────────
  {
    name: "genome-assembly",
    path: "/services/genome-assembly",
    tripwire: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "genome-annotation",
    path: "/services/genome-annotation",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "genome-alignment",
    path: "/services/genome-alignment",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "blast",
    path: "/services/blast",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "primer-design",
    path: "/services/primer-design",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "similar-genome-finder",
    path: "/services/similar-genome-finder",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "variation-analysis",
    path: "/services/variation-analysis",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Metagenomics service forms ───────────────────────────────────────────────
  {
    name: "metagenomic-binning",
    path: "/services/metagenomic-binning",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "metagenomic-read-mapping",
    path: "/services/metagenomic-read-mapping",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "taxonomic-classification",
    path: "/services/taxonomic-classification",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Phylogenomics service forms ──────────────────────────────────────────────
  {
    name: "viral-genome-tree",
    path: "/services/viral-genome-tree",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Protein tools service forms ──────────────────────────────────────────────
  {
    name: "gene-protein-tree",
    path: "/services/gene-protein-tree",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "meta-cats",
    path: "/services/meta-cats",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "msa-snp-analysis",
    path: "/services/msa-snp-analysis",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "proteome-comparison",
    path: "/services/proteome-comparison",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Utilities service forms ──────────────────────────────────────────────────
  {
    name: "fastq-utilities",
    path: "/services/fastq-utilities",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Viral tools service forms ────────────────────────────────────────────────
  {
    name: "influenza-ha-subtype",
    path: "/services/influenza-ha-subtype",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "sars-cov2-genome-analysis",
    path: "/services/sars-cov2-genome-analysis",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "sars-cov2-wastewater-analysis",
    path: "/services/sars-cov2-wastewater-analysis",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "subspecies-classification",
    path: "/services/subspecies-classification",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "viral-assembly",
    path: "/services/viral-assembly",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // ── Workspace (authenticated) ────────────────────────────────────────────────
  // Navigating to /workspace triggers a server redirect to /workspace/username/home.
  // The prepare hook waits for the redirect so the scan runs on the workspace browser.
  // This single entry covers: workspace/page.tsx AND workspace/[username]/home/[[...path]]/page.tsx
  // AND workspace/[username]/[folder]/[[...path]]/page.tsx (same component, different root).
  {
    name: "workspace",
    path: "/workspace",
    needsWorkspace: true,
    tripwire: true,
    mobile: true,
    covers: [
      "workspace/page.tsx",
      "workspace/[username]/home/[[...path]]/page.tsx",
      "workspace/[username]/[folder]/[[...path]]/page.tsx",
    ],
    prepare: async (page) => {
      await page.waitForURL(/\/workspace\/[^/]+\/home/, { timeout: 10_000 });
      await page.getByPlaceholder(/search files/i).waitFor({ timeout: 10_000 });
      await page.waitForLoadState("networkidle");
    },
  },
  // Public workspace listing (no auth required to VIEW, but authenticated user sees their context)
  {
    name: "workspace-public",
    path: "/workspace/public",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "workspace-public-user",
    path: `/workspace/public/${e2eUsername}`,
    covers: ["workspace/public/[username]/[...path]/page.tsx"],
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "workspace-shared",
    path: "/workspace/shared",
    needsWorkspace: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "workspace-workshop",
    path: "/workspace/workshop",
    needsWorkspace: true,
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },

  // Redirect-only workspace routes — not scanned, just counted for meta-test accounting.
  {
    name: "workspace-home-redirect",
    path: "/workspace/home",
    redirectOnly: true,
    covers: ["workspace/home/[[...path]]/page.tsx"],
  },
  {
    name: "workspace-username-redirect",
    path: `/workspace/${e2eUsername}`,
    redirectOnly: true,
    covers: ["workspace/[username]/page.tsx"],
  },

  // ── Structure viewer ─────────────────────────────────────────────────────────
  // Molstar 3D canvas is excluded from axe; the wrapper element must carry an accessible name.
  {
    name: "structure-viewer",
    path: "/viewer/structure",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
];

// All src/app page.tsx paths (relative to src/app/) covered by this route table.
// coverage.meta.spec.ts globs the actual files and diffs against this set.
export const coveredPageFiles = new Set<string>([
  // Root
  "page.tsx",
  // Auth
  "(auth)/sign-in/page.tsx",
  "(auth)/sign-up/page.tsx",
  "(auth)/forgot-password/page.tsx",
  // Footer / static
  "(footer)/about/page.tsx",
  "(footer)/citations/page.tsx",
  "(footer)/contact/page.tsx",
  "(footer)/faq/page.tsx",
  "(footer)/funding/page.tsx",
  "(footer)/help/page.tsx",
  "(footer)/news/page.tsx",
  "(footer)/privacy-policy/page.tsx",
  "(footer)/publications/page.tsx",
  "(footer)/related-resources/page.tsx",
  "(footer)/team/page.tsx",
  "(footer)/updates/page.tsx",
  // Taxonomy (views)
  "(views)/taxonomy/[taxonId]/page.tsx",
  "(views)/taxonomy/page.tsx",
  // Genome (views)
  "(views)/genome/[genomeId]/page.tsx",
  "(views)/genome/page.tsx",
  // Feature (views)
  "(views)/feature/[featureId]/page.tsx",
  "(views)/feature/page.tsx",
  // Epitope (views)
  "(views)/epitope/[epitopeId]/page.tsx",
  "(views)/epitope/page.tsx",
  // Surveillance (views)
  "(views)/surveillance/[sampleId]/page.tsx",
  "(views)/surveillance/page.tsx",
  // Serology (views)
  "(views)/serology/[sampleId]/page.tsx",
  "(views)/serology/page.tsx",
  // List-only views
  "(views)/strain/page.tsx",
  "(views)/domains-and-motifs/page.tsx",
  "(views)/experiment/page.tsx",
  "(views)/experiment/[experimentId]/page.tsx",
  "(views)/protein-structure/page.tsx",
  // Organisms
  "organisms/all/page.tsx",
  "organisms/bacteria/page.tsx",
  "organisms/viruses/page.tsx",
  // Jobs / search / settings
  "jobs/page.tsx",
  "search/page.tsx",
  "settings/page.tsx",
  // Services
  "services/page.tsx",
  "services/(genomics)/blast/page.tsx",
  "services/(genomics)/genome-alignment/page.tsx",
  "services/(genomics)/genome-annotation/page.tsx",
  "services/(genomics)/genome-assembly/page.tsx",
  "services/(genomics)/primer-design/page.tsx",
  "services/(genomics)/similar-genome-finder/page.tsx",
  "services/(genomics)/variation-analysis/page.tsx",
  "services/(metagenomics)/metagenomic-binning/page.tsx",
  "services/(metagenomics)/metagenomic-read-mapping/page.tsx",
  "services/(metagenomics)/taxonomic-classification/page.tsx",
  "services/(phylogenomics)/viral-genome-tree/page.tsx",
  "services/(protein-tools)/gene-protein-tree/page.tsx",
  "services/(protein-tools)/meta-cats/page.tsx",
  "services/(protein-tools)/msa-snp-analysis/page.tsx",
  "services/(protein-tools)/proteome-comparison/page.tsx",
  "services/(utilities)/fastq-utilities/page.tsx",
  "services/(viral-tools)/influenza-ha-subtype/page.tsx",
  "services/(viral-tools)/sars-cov2-genome-analysis/page.tsx",
  "services/(viral-tools)/sars-cov2-wastewater-analysis/page.tsx",
  "services/(viral-tools)/subspecies-classification/page.tsx",
  "services/(viral-tools)/viral-assembly/page.tsx",
  // Structure viewer
  "viewer/structure/[[...path]]/page.tsx",
  // Workspace
  "workspace/page.tsx",
  "workspace/home/[[...path]]/page.tsx", // redirectOnly
  "workspace/[username]/page.tsx", // redirectOnly
  "workspace/[username]/home/[[...path]]/page.tsx",
  "workspace/[username]/[folder]/[[...path]]/page.tsx",
  "workspace/public/page.tsx",
  "workspace/public/[username]/page.tsx",
  "workspace/public/[username]/[...path]/page.tsx",
  "workspace/shared/[[...path]]/page.tsx",
  "workspace/workshop/page.tsx",
]);
