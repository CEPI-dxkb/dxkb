import { resolve } from "node:path";

import { valueImportsMatching } from "../static-imports";

const fromDir = resolve(__dirname, "../../components/organisms");
const heavy = /^@\/components\/heavy/;

describe("valueImportsMatching", () => {
  it("reports value imports and re-exports, relative ones by their alias path", () => {
    const source = [
      'import { Chart } from "@/components/heavy/chart";',
      'import "../heavy/side-effect";',
      'export { Map } from "@/components/heavy/map";',
      'import { Light } from "@/components/light";',
    ].join("\n");

    expect(valueImportsMatching(source, fromDir, heavy)).toEqual([
      "@/components/heavy/chart",
      "../heavy/side-effect",
      "@/components/heavy/map",
    ]);
  });

  // TypeScript drops a declaration whose every specifier is `type`, so it
  // adds nothing to the runtime graph.
  it("leaves out type-only imports and exports, inline `type` ones too", () => {
    const source = [
      'import type { ChartProps } from "@/components/heavy/chart";',
      'import { type DonutDatum } from "@/components/heavy/donut";',
      "import {\n  type A,\n  type B,\n} from \"@/components/heavy/multi\";",
      'export type { MapProps } from "@/components/heavy/map";',
      'export { type Point } from "@/components/heavy/geo";',
    ].join("\n");

    expect(valueImportsMatching(source, fromDir, heavy)).toEqual([]);
  });

  it("keeps a declaration that mixes a value with inline types", () => {
    const source = [
      'import { type ChartProps, Chart } from "@/components/heavy/chart";',
      'import Donut, { type DonutDatum } from "@/components/heavy/donut";',
    ].join("\n");

    expect(valueImportsMatching(source, fromDir, heavy)).toEqual([
      "@/components/heavy/chart",
      "@/components/heavy/donut",
    ]);
  });
});
