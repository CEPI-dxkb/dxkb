import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { valueImportsMatching } from "@/test-helpers/static-imports";

const organismsDir = resolve(__dirname, "..");

// The Overview chart clients must stay behind their lazy-* wrappers: a value
// import puts them back in every route's chunk group.
const chartModule =
  /^@\/components\/organisms\/(?:geo-distribution\/geo-distribution-client|reference-genomes\/reference-genomes-client|metadata-distributions\/(?!lazy-charts$|metadata-distributions|_shared\/)[a-z0-9-]+)$/;

const serverComponents = [
  "geo-distribution/geo-distribution.tsx",
  "metadata-distributions/metadata-distributions.tsx",
  "reference-genomes/reference-genomes.tsx",
];

describe("Overview server components", () => {
  it("recognizes value imports of a chart module, relative ones included, and lets type imports and lazy wrappers through", () => {
    const dir = join(organismsDir, "metadata-distributions");
    const source = [
      'import { BarChart } from "./bar-chart";',
      'import { AmrBarStackChart } from "@/components/organisms/metadata-distributions/amr-bar-stack-chart";',
      'import {\n  DonutChart,\n} from "./donut-chart";',
      'import { GeoDistributionClient } from "../geo-distribution/geo-distribution-client";',
      'import { ReferenceGenomesClient } from "../reference-genomes/reference-genomes-client";',
      'import type { DonutDatum } from "./donut-chart";',
      'import { LazyBarChart } from "./lazy-charts";',
      'import { chartDimensions } from "./_shared/chart-dimensions";',
    ].join("\n");

    expect(valueImportsMatching(source, dir, chartModule)).toEqual([
      "./bar-chart",
      "@/components/organisms/metadata-distributions/amr-bar-stack-chart",
      "./donut-chart",
      "../geo-distribution/geo-distribution-client",
      "../reference-genomes/reference-genomes-client",
    ]);
  });

  it("import their chart clients only through the lazy wrappers", () => {
    const offenders = serverComponents.flatMap((file) =>
      valueImportsMatching(
        readFileSync(join(organismsDir, file), "utf8"),
        join(organismsDir, file, ".."),
        chartModule,
      ).map((specifier) => `${file}: ${specifier}`),
    );

    expect(offenders).toEqual([]);
  });
});
