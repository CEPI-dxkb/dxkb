import { readFileSync } from "node:fs";
import path from "node:path";

import { countryZoomOptions } from "../country-zoom-options";
import { extractFeatures, type TopologyLike } from "../topology-utils";

const features = extractFeatures(
  JSON.parse(
    readFileSync(
      path.join(process.cwd(), "public/maps/countries-110m.json"),
      "utf8",
    ),
  ) as TopologyLike,
  "countries",
);

describe("countryZoomOptions", () => {
  it("lists topology countries that have data, sorted", () => {
    expect(
      countryZoomOptions(features, { Germany: 4, Brazil: 2, Canada: 9 }),
    ).toEqual(["Brazil", "Canada", "Germany"]);
  });

  it("resolves API aliases to the topology name the map paints", () => {
    expect(
      countryZoomOptions(features, {
        "Russian Federation": 3,
        Czechia: 1,
        "Côte d'Ivoire": 2,
      }),
    ).toEqual(["Côte d'Ivoire", "Czechia", "Russia"]);
  });

  it("leaves out zero counts and countries absent from the data", () => {
    expect(countryZoomOptions(features, { Germany: 0, France: 5 })).toEqual([
      "France",
    ]);
  });

  it("leaves out data keys that have no topology feature", () => {
    // Singapore is not in countries-110m.json: a dead option if built from the data keys.
    expect(countryZoomOptions(features, { Singapore: 7, Italy: 1 })).toEqual([
      "Italy",
    ]);
  });

  it("leaves out the USA, which opens the US view instead of zooming", () => {
    expect(countryZoomOptions(features, { USA: 100, Italy: 1 })).toEqual([
      "Italy",
    ]);
  });

  it("returns nothing for no features or no data", () => {
    expect(countryZoomOptions([], { Germany: 1 })).toEqual([]);
    expect(countryZoomOptions(features, {})).toEqual([]);
  });
});
