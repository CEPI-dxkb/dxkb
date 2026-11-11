import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { valueImportsMatching } from "@/test-helpers/static-imports";

const taxonViewsDir = resolve(__dirname, "..");

// Tab client roots that must reach a route only through lazy-tab-roots.
const tabRootModule =
  /^@\/components\/(?:views(?:\/index|\/[a-z-]+-collection)?|interactions\/interactions-subview-shell|phylogeny\/[a-z-]+-phylogeny-panel|taxonomy\/taxonomy-tree-panel)$/;

/** Module specifiers of the value imports of a tab root in a source in `fromDir`. */
function tabRootValueImports(source: string, fromDir: string): string[] {
  return valueImportsMatching(source, fromDir, tabRootModule);
}

describe("taxon tab factories", () => {
  it("recognizes value imports of a tab root, relative ones included, and lets type imports through", () => {
    const source = [
      'import { GenomeResourceCollection } from "@/components/views";',
      "import {",
      "  FeatureResourceCollection,",
      '} from "@/components/views/feature-resource-collection";',
      'import TreePanel from "@/components/taxonomy/taxonomy-tree-panel";',
      'import "@/components/phylogeny/viral-phylogeny-panel";',
      'import { BacterialPhylogenyPanel } from "@/components/phylogeny/bacterial-phylogeny-panel";',
      'import { InteractionsSubviewShell } from "@/components/interactions/interactions-subview-shell";',
      'import type { ResourceChildCollection } from "@/components/views/resource-child-collection";',
      'import { Tabs } from "@/components/ui/tabs";',
      'import { OverviewCard } from "@/components/views/overview-card";',
      'import { StrainResourceCollection } from "../../views/strain-resource-collection";',
      'import { EpitopeResourceCollection } from "../../views";',
      'import { SerologyResourceCollection } from "@/components/views/index";',
      'import { InteractionsSubviewShell as Shell } from "../../interactions/interactions-subview-shell";',
      'import { LazyGenomeResourceCollection } from "./lazy-tab-roots";',
      'import type { TaxonViewScope } from "./scope";',
    ].join("\n");

    expect(tabRootValueImports(source, taxonViewsDir)).toEqual([
      "@/components/views",
      "@/components/views/feature-resource-collection",
      "@/components/taxonomy/taxonomy-tree-panel",
      "@/components/phylogeny/viral-phylogeny-panel",
      "@/components/phylogeny/bacterial-phylogeny-panel",
      "@/components/interactions/interactions-subview-shell",
      "../../views/strain-resource-collection",
      "../../views",
      "@/components/views/index",
      "../../interactions/interactions-subview-shell",
    ]);
  });

  it("reach their client roots only through lazy-tab-roots", () => {
    // A static import puts the root in every taxon-tab route's chunk group.
    const files = readdirSync(taxonViewsDir).filter(
      (name) => /\.tsx?$/.test(name) && name !== "lazy-tab-roots.tsx",
    );
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.flatMap((name) =>
      tabRootValueImports(
        readFileSync(join(taxonViewsDir, name), "utf8"),
        taxonViewsDir,
      ).map(
        (specifier) => `${name}: ${specifier}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});
