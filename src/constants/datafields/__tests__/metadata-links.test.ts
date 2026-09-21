import { validateRql } from "@/lib/data-api";
import { biosetFields } from "../bioset";
import { epitopeFields } from "../epitope";
import { epitopeAssayFields } from "../epitope_assay";
import { experimentFields } from "../experiment";
import { genomeFields } from "../genome";
import { genomeAmrFields } from "../genome_amr";
import { genomeFeatureFields } from "../genome_feature";
import { genomeSequenceFields } from "../genome_sequence";
import { ppiFields } from "../ppi";
import { proteinFeatureFields } from "../protein_feature";
import { proteinStructureFields } from "../protein_structure";
import { sequenceFeatureFields } from "../sequence_feature";
import { serologyFields } from "../serology";
import { strainFields } from "../strain";
import { surveillanceFields } from "../surveillance";
import { taxonomyFields } from "../taxonomy";
import type { DataFieldMap } from "../types";

/**
 * Every `DataFieldMap` in this directory, keyed by resource name. Item 20B's audit
 * swept this whole set for three stale-link classes (legacy `/view/*` routes,
 * hardcoded production origins, plain-http targets) — this test pins the result so
 * a future edit can't silently reintroduce one.
 */
const allDataFieldMaps: Record<string, DataFieldMap> = {
  bioset: biosetFields,
  epitope: epitopeFields,
  epitope_assay: epitopeAssayFields,
  experiment: experimentFields,
  genome: genomeFields,
  genome_amr: genomeAmrFields,
  genome_feature: genomeFeatureFields,
  genome_sequence: genomeSequenceFields,
  ppi: ppiFields,
  protein_feature: proteinFeatureFields,
  protein_structure: proteinStructureFields,
  sequence_feature: sequenceFeatureFields,
  serology: serologyFields,
  strain: strainFields,
  surveillance: surveillanceFields,
  taxonomy: taxonomyFields,
};

interface LinkedField {
  resource: string;
  field: string;
  link: string;
}

function linkedFields(): LinkedField[] {
  return Object.entries(allDataFieldMaps).flatMap(([resource, fields]) =>
    Object.values(fields)
      .filter((field) => field.link !== undefined)
      .map((field) => ({
        resource,
        field: field.field,
        link: field.link as string,
      })),
  );
}

describe("datafields link templates", () => {
  it("carries at least one linked field, so this audit is not vacuous", () => {
    expect(linkedFields().length).toBeGreaterThan(0);
  });

  it("no metadata link points at a stale /view/* route", () => {
    for (const { resource, field, link } of linkedFields()) {
      expect(link, `${resource}.${field} -> ${link}`).not.toMatch(/^\/view\//);
    }
  });

  it("no metadata link hardcodes the production origin", () => {
    for (const { resource, field, link } of linkedFields()) {
      expect(link, `${resource}.${field} -> ${link}`).not.toMatch(/dxkb\.org/);
    }
  });

  it("every metadata link with an explicit scheme uses https, never plain http", () => {
    for (const { resource, field, link } of linkedFields()) {
      expect(link, `${resource}.${field} -> ${link}`).not.toMatch(
        /^http:\/\//,
      );
    }
  });

  it("every internal (relative) metadata link resolves through a real route base", () => {
    // Canonical internal destinations this app actually serves. A relative link
    // outside this set is either a typo or a route this sweep missed.
    const knownInternalBases = [
      "/genome/",
      "/taxonomy/",
      "/feature/",
      "/feature?",
    ];
    for (const { resource, field, link } of linkedFields()) {
      if (link.startsWith("/")) {
        expect(
          knownInternalBases.some((base) => link.startsWith(base)),
          `${resource}.${field} -> ${link} does not start with a known internal route`,
        ).toBe(true);
      }
    }
  });

  it("keeps the two item-15-confirmed active fields fixed", () => {
    expect(strainFields.taxon_id.link).toBe("/taxonomy/{value}");
    expect(proteinFeatureFields.refseq_locus_tag.link).toBe(
      "https://www.ncbi.nlm.nih.gov/protein/?term={value}",
    );
  });

  it("converges the Taxonomy internal destination across every migrated field", () => {
    // epitope, genome_feature, and strain used to point at the stale
    // /view/Taxonomy/{value}; protein_feature was already canonical. All four
    // should now agree.
    expect(epitopeFields.taxon_id.link).toBe("/taxonomy/{value}");
    expect(genomeFeatureFields.taxon_id.link).toBe("/taxonomy/{value}");
    expect(strainFields.taxon_id.link).toBe("/taxonomy/{value}");
    expect(proteinFeatureFields.taxon_id.link).toBe("/taxonomy/{value}");
  });

  it("keeps genome.contigs internal and row-aware instead of a hardcoded production origin", () => {
    expect(genomeFields.contigs.link).toBe("/genome/{genome_id}?tab=sequences");
  });

  it("rewrites genome_sequence.sequence_id's stale FeatureList target onto the new Feature collection RQL contract", () => {
    // Confirmed against src/proxy.ts's live /view/* redirect (mapLegacyViewPath),
    // which would map the old `/view/FeatureList/?and(...)` path+query to exactly
    // this `/feature?rql=...` form — and against the real RQL validator.
    expect(genomeSequenceFields.sequence_id.link).toBe(
      "/feature?rql=and(eq(annotation,PATRIC),eq(sequence_id,{value}),eq(feature_type,CDS))",
    );
  });

  it("genome_sequence.sequence_id's rewritten RQL round-trips through the real validator unchanged", () => {
    const resolved =
      "and(eq(annotation,PATRIC),eq(sequence_id,83332.12.1),eq(feature_type,CDS))";
    expect(validateRql("genome_feature", resolved)).toBe(resolved);
  });
});
