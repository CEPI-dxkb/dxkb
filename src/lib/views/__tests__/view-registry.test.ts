import type { ViewRegistry } from "../view-types";
import {
  viewRegistry,
  viewSegments,
  legacyViewTargets,
} from "../view-registry";

// Cast to the loose ViewRegistry type so every entry is a ViewTypeEntry rather
// than the narrow inferred literals.
const reg = viewRegistry as ViewRegistry;

describe("viewRegistry", () => {
  it("has exactly 10 segments", () => {
    expect(viewSegments).toHaveLength(10);
  });

  it("keys each entry by its own segment", () => {
    for (const [key, entry] of Object.entries(reg)) {
      expect(entry.segment).toBe(key);
    }
  });

  it("marks strain and domains-and-motifs as list-only (no legacy singular)", () => {
    expect(reg.strain.legacySingular).toBeUndefined();
    expect(reg["domains-and-motifs"].legacySingular).toBeUndefined();
  });

  it("gives experiment the ExperimentComparison legacy singular name", () => {
    expect(reg.experiment.legacySingular).toBe("ExperimentComparison");
  });

  it("maps every legacy name to a unique existing segment", () => {
    const names = Object.values(reg).flatMap(
      (e) =>
        [
          e.legacySingular,
          ...(e.legacySingularAliases ?? []),
          e.legacyList,
          ...(e.legacyListAliases ?? []),
        ].filter(Boolean) as string[],
    );
    expect(names.length).toBeGreaterThanOrEqual(10);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(legacyViewTargets[name]).toBeDefined();
      expect(reg[legacyViewTargets[name]?.segment ?? ""]).toBeDefined();
    }
  });

  it("reverse-maps a known legacy name", () => {
    expect(legacyViewTargets.GenomeList?.segment).toBe("genome");
    expect(legacyViewTargets.Taxonomy?.segment).toBe("taxonomy");
    expect(legacyViewTargets.Protein?.segment).toBe("feature");
    expect(legacyViewTargets.ProteinList?.segment).toBe("feature");
    expect(legacyViewTargets.DomainsAndMotifsList?.segment).toBe(
      "domains-and-motifs",
    );
    expect(legacyViewTargets.ProteinFeaturesList?.segment).toBe(
      "domains-and-motifs",
    );
  });
});
