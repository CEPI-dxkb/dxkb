import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  permissiveBackendOverrides,
} from "../../fixtures/overrides";

interface ServiceCase {
  slug: string;
  title: RegExp;
  category:
    | "genomics"
    | "metagenomics"
    | "phylogenomics"
    | "protein-tools"
    | "utilities"
    | "viral-tools";
}

const services: ServiceCase[] = [
  { slug: "blast", title: /blast/i, category: "genomics" },
  { slug: "genome-alignment", title: /genome alignment/i, category: "genomics" },
  { slug: "genome-annotation", title: /genome annotation/i, category: "genomics" },
  { slug: "genome-assembly", title: /genome assembly/i, category: "genomics" },
  { slug: "primer-design", title: /primer design/i, category: "genomics" },
  { slug: "similar-genome-finder", title: /similar genome finder/i, category: "genomics" },
  { slug: "variation-analysis", title: /variation analysis/i, category: "genomics" },
  { slug: "metagenomic-binning", title: /metagenomic binning/i, category: "metagenomics" },
  { slug: "metagenomic-read-mapping", title: /metagenomic read mapping/i, category: "metagenomics" },
  { slug: "taxonomic-classification", title: /taxonomic classification/i, category: "metagenomics" },
  { slug: "viral-genome-tree", title: /viral genome tree/i, category: "phylogenomics" },
  { slug: "gene-protein-tree", title: /gene\s*\/\s*protein tree/i, category: "protein-tools" },
  { slug: "meta-cats", title: /meta-cats/i, category: "protein-tools" },
  { slug: "msa-snp-analysis", title: /msa\s*&\s*snp/i, category: "protein-tools" },
  { slug: "proteome-comparison", title: /proteome comparison/i, category: "protein-tools" },
  { slug: "fastq-utilities", title: /fastq utilities/i, category: "utilities" },
  { slug: "influenza-ha-subtype", title: /ha subtype/i, category: "viral-tools" },
  { slug: "sars-cov2-genome-analysis", title: /sars-cov-2 genome analysis/i, category: "viral-tools" },
  { slug: "sars-cov2-wastewater-analysis", title: /sars-cov-2 wastewater/i, category: "viral-tools" },
  { slug: "subspecies-classification", title: /subspecies classification/i, category: "viral-tools" },
  { slug: "viral-assembly", title: /viral assembly/i, category: "viral-tools" },
];

test.describe("services — smoke (form renders with h1)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...jobsOverrides,
        ...permissiveBackendOverrides,
      ],
    });
  });

  for (const { slug, title, category } of services) {
    test(`${category} / ${slug} form renders with h1`, async ({ page }) => {
      await page.goto(`/services/${slug}`);
      await expect(page).not.toHaveURL(/sign-in/);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
    });
  }
});
