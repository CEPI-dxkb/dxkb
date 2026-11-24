import { readFileSync } from "node:fs";
import path from "node:path";

import * as topojson from "topojson-client";

import {
  countyDataKey,
  crossesAntimeridian,
  featureName,
  unmatchedCountyNames,
  warnUnmatchedCounties,
} from "../topology-utils";

describe("featureName", () => {
  it("prefers .name when present", () => {
    expect(featureName({ name: "Idaho", NAME: "ID" })).toBe("Idaho");
  });

  it("falls back to .NAME when .name is absent", () => {
    expect(featureName({ NAME: "Idaho" })).toBe("Idaho");
  });

  it("returns empty string when neither field is present", () => {
    expect(featureName({})).toBe("");
  });

  it("returns empty string when feature props are undefined", () => {
    expect(featureName(undefined)).toBe("");
  });
});

describe("crossesAntimeridian", () => {
  function featureFromCoords(coords: number[][][]): GeoJSON.Feature {
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: coords },
    };
  }

  it("returns false for a contiguous-US feature", () => {
    expect(
      crossesAntimeridian(
        featureFromCoords([[[-100, 40], [-90, 40], [-90, 45], [-100, 45], [-100, 40]]]),
      ),
    ).toBe(false);
  });

  it("returns true for a polygon that straddles 180/-180 (Aleutians-shaped)", () => {
    expect(
      crossesAntimeridian(
        featureFromCoords([[[170, 51], [179, 51], [-179, 52], [-170, 52], [170, 51]]]),
      ),
    ).toBe(true);
  });

  it("returns false for a polygon with only negative longitudes (mainland Alaska)", () => {
    expect(
      crossesAntimeridian(
        featureFromCoords([[[-165, 60], [-145, 60], [-145, 70], [-165, 70], [-165, 60]]]),
      ),
    ).toBe(false);
  });

  it("returns false when coordinates field is missing", () => {
    const feature: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [] } as unknown as GeoJSON.Geometry,
    };
    expect(crossesAntimeridian(feature)).toBe(false);
  });
});

describe("countyDataKey", () => {
  it("scopes a county to its state", () => {
    expect(countyDataKey("Wyoming", "Park")).toBe("Wyoming|Park");
  });

  it("uses the bare name without a selected state", () => {
    expect(countyDataKey(null, "Park")).toBe("Park");
  });
});

describe("unmatchedCountyNames", () => {
  it("lists the state's data counties that no map county is called", () => {
    expect(
      unmatchedCountyNames(
        { "Wyoming|Park": 3, "Wyoming|Parks": 1, "Idaho|Ada": 9 },
        "Wyoming",
        ["Park", "Teton"],
      ),
    ).toEqual(["Parks"]);
  });

  it("matches the Wyoming rows the e2e mock serves against the real counties map", () => {
    const topology = JSON.parse(
      readFileSync(path.join(process.cwd(), "public/maps/counties-10m.json"), "utf8"),
    ) as { objects: { counties: unknown } };
    const collection = topojson.feature(
      topology as never,
      topology.objects.counties as never,
    ) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, { name?: string }>;
    const wyomingNames = collection.features
      .filter((feature) => String((feature as { id?: string | number }).id ?? "").startsWith("56"))
      .map((feature) => feature.properties.name ?? "");

    expect(
      unmatchedCountyNames({ "Wyoming|Park": 30, "Wyoming|Teton": 18 }, "Wyoming", wyomingNames),
    ).toEqual([]);
  });
});

describe("warnUnmatchedCounties", () => {
  it("warns once per state and name set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    warnUnmatchedCounties("Warnland", ["Alpha", "Beta"]);
    warnUnmatchedCounties("Warnland", ["Alpha", "Beta"]);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("county names in Warnland match no county on the map"),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Alpha, Beta"));
    warn.mockRestore();
  });

  it("stays quiet when every county matched", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    warnUnmatchedCounties("Quietland", []);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
