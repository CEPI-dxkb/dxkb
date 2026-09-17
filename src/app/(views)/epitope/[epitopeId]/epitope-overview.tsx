import { MetadataLink } from "@/components/detail-panel/metadata-link";
import { OverviewSection, formatOverviewValue } from "@/components/views";
import type { EpitopeViewRecord } from "@/lib/epitope-view";
import { taxonomyHref } from "@/lib/views/hrefs";
import { isTaxonId } from "@/lib/taxonomy-view";

interface EpitopeOverviewProps {
  epitope: EpitopeViewRecord;
}

export function EpitopeOverview({ epitope }: EpitopeOverviewProps) {
  const taxonId = String(epitope.taxon_id);
  // `taxonomyHref` throws on an unrecognized ID, so the shape check has to gate
  // the call. The resolved href then doubles as the field's availability: an
  // unrecognized taxon ID shows no Taxon ID field at all, as before.
  const taxonomyDestination = isTaxonId(taxonId)
    ? taxonomyHref(taxonId)
    : undefined;
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      <OverviewSection
        title="Identity and sequence"
        fields={[
          { label: "Epitope ID", value: epitope.epitope_id },
          { label: "Epitope type", value: epitope.epitope_type },
          {
            label: "Sequence or structure",
            value: epitope.epitope_sequence,
          },
          { label: "Start", value: epitope.start },
          { label: "End", value: epitope.end },
        ]}
      />
      <OverviewSection
        title="Organism and protein"
        fields={[
          { label: "Organism", value: epitope.organism },
          {
            label: "Taxon ID",
            value: epitope.taxon_id,
            available: taxonomyDestination !== undefined,
            className: "mt-0.5",
            children: taxonomyDestination ? (
              <MetadataLink href={taxonomyDestination}>
                {formatOverviewValue(epitope.taxon_id)}
              </MetadataLink>
            ) : undefined,
          },
          { label: "Protein name", value: epitope.protein_name },
          { label: "Protein ID", value: epitope.protein_id },
          { label: "Protein accession", value: epitope.protein_accession },
          { label: "Host", value: epitope.host_name },
        ]}
      />
      <OverviewSection
        title="Assay summary"
        fields={[
          { label: "Total assays", value: epitope.total_assays },
          { label: "Assay results", value: epitope.assay_results },
          { label: "B-cell assays", value: epitope.bcell_assays },
          { label: "T-cell assays", value: epitope.tcell_assays },
          { label: "MHC assays", value: epitope.mhc_assays },
        ]}
      />
      <OverviewSection
        title="Provenance and comments"
        fields={[
          { label: "Comments", value: epitope.comments },
          { label: "Date added", value: epitope.date_inserted },
        ]}
      />
    </div>
  );
}
