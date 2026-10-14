import { MetadataLink } from "@/components/detail-panel/metadata-link";
import { resolveLink } from "@/components/detail-panel/metadata-link-policy";
import {
  OverviewSection,
  formatOverviewValue,
  linkListField,
} from "@/components/views";
import { strainFields } from "@/constants/datafields/strain";
import { isTaxonId } from "@/lib/taxonomy-view";
import {
  genomeIdsFromStrains,
  isStrainAccessionField,
  strainAccessionUrlTemplate,
  type StrainViewRecord,
} from "@/lib/strain-view";
import { genomeHref, taxonomyHref } from "@/lib/views/hrefs";

/**
 * The per-segment accession fields, in `strainFields` order (influenza's eight
 * numbered segments, then the S/M/L of tri-segmented viruses). The combined
 * `genbank_accessions` list is shown on its own.
 */
const segmentFields = Object.values(strainFields).filter(
  (field) =>
    isStrainAccessionField(field.field) &&
    field.field !== "genbank_accessions",
);

function accessions(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && item !== "",
      )
    : [];
}

function accessionLinks(value: unknown) {
  return accessions(value).map((accession) => ({
    href: resolveLink(strainAccessionUrlTemplate, { accession }, "accession"),
    label: accession,
  }));
}

interface StrainOverviewProps {
  strain: StrainViewRecord;
}

export function StrainOverview({ strain }: StrainOverviewProps) {
  const taxonId = String(strain.taxon_id);
  // `taxonomyHref` throws on an unrecognized ID, so the shape check has to gate
  // the call. The resolved href then doubles as the field's availability.
  const taxonomyDestination = isTaxonId(taxonId)
    ? taxonomyHref(taxonId)
    : undefined;
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      <OverviewSection
        title="Strain"
        fields={[
          { label: "Strain", value: strain.strain },
          { label: "Subtype", value: strain.subtype },
          { label: "H type", value: strain.h_type },
          { label: "N type", value: strain.n_type },
          { label: "Segment count", value: strain.segment_count },
          { label: "Status", value: strain.status },
          { label: "Season", value: strain.season },
          { label: "Date added", value: strain.date_inserted },
        ]}
      />
      <OverviewSection
        title="Taxonomy"
        fields={[
          { label: "Family", value: strain.family },
          { label: "Genus", value: strain.genus },
          { label: "Species", value: strain.species },
          {
            label: "Taxon ID",
            value: strain.taxon_id,
            available: taxonomyDestination !== undefined,
            className: "mt-0.5",
            children: taxonomyDestination ? (
              <MetadataLink href={taxonomyDestination}>
                {formatOverviewValue(strain.taxon_id)}
              </MetadataLink>
            ) : undefined,
          },
        ]}
      />
      <OverviewSection
        title="Host and isolation"
        fields={[
          { label: "Host", value: strain.host_common_name },
          { label: "Host name", value: strain.host_name },
          { label: "Host group", value: strain.host_group },
          { label: "Lab host", value: strain.lab_host },
          { label: "Passage", value: strain.passage },
          { label: "Isolation country", value: strain.isolation_country },
          { label: "Geographic group", value: strain.geographic_group },
          { label: "Collection date", value: strain.collection_date },
          { label: "Collection year", value: strain.collection_year },
        ]}
      />
      <OverviewSection
        title="Segments and genomes"
        fields={[
          linkListField(
            "Genomes",
            genomeIdsFromStrains([strain]).map((genomeId) => ({
              href: genomeHref(genomeId),
              label: genomeId,
            })),
          ),
          linkListField(
            "GenBank accessions",
            accessionLinks(strain.genbank_accessions),
          ),
          ...segmentFields.map((field) => ({
            ...linkListField(field.label, accessionLinks(strain[field.field])),
            field: field.field,
          })),
        ]}
      />
    </div>
  );
}
