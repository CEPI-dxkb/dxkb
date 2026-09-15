import Link from "next/link";
import {
  OverviewCard,
  OverviewField,
  formatOverviewValue,
} from "@/components/views";
import type { EpitopeViewRecord } from "@/lib/epitope-view";
import { taxonomyHref } from "@/lib/views/hrefs";
import { isTaxonId } from "@/lib/taxonomy-view";

interface EpitopeOverviewProps {
  epitope: EpitopeViewRecord;
}

export function EpitopeOverview({ epitope }: EpitopeOverviewProps) {
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      <OverviewCard title="Identity and sequence">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Epitope ID" value={epitope.epitope_id} />
          <OverviewField label="Epitope type" value={epitope.epitope_type} />
          <OverviewField
            label="Sequence or structure"
            value={epitope.epitope_sequence}
          />
          <OverviewField label="Start" value={epitope.start} />
          <OverviewField label="End" value={epitope.end} />
        </dl>
      </OverviewCard>
      <OverviewCard title="Organism and protein">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Organism" value={epitope.organism} />
          {isTaxonId(String(epitope.taxon_id)) && (
            <OverviewField label="Taxon ID" available className="mt-0.5">
              <Link
                className="text-primary underline"
                href={taxonomyHref(String(epitope.taxon_id))}
              >
                {formatOverviewValue(epitope.taxon_id)}
              </Link>
            </OverviewField>
          )}
          <OverviewField label="Protein name" value={epitope.protein_name} />
          <OverviewField label="Protein ID" value={epitope.protein_id} />
          <OverviewField
            label="Protein accession"
            value={epitope.protein_accession}
          />
          <OverviewField label="Host" value={epitope.host_name} />
        </dl>
      </OverviewCard>
      <OverviewCard title="Assay summary">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Total assays" value={epitope.total_assays} />
          <OverviewField
            label="Assay results"
            value={epitope.assay_results}
          />
          <OverviewField label="B-cell assays" value={epitope.bcell_assays} />
          <OverviewField label="T-cell assays" value={epitope.tcell_assays} />
          <OverviewField label="MHC assays" value={epitope.mhc_assays} />
        </dl>
      </OverviewCard>
      <OverviewCard title="Provenance and comments">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Comments" value={epitope.comments} />
          <OverviewField label="Date added" value={epitope.date_inserted} />
        </dl>
      </OverviewCard>
    </div>
  );
}
