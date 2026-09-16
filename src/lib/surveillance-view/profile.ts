import type { ResourceCollectionProfile } from "@/components/views";
import { surveillanceHref } from "@/lib/views/hrefs";
import { surveillanceMetadata } from "./fields";
import { surveillanceStructuralRql } from "./query";
import type { SurveillanceViewRecord } from "./schema";

const surveillanceColumns = surveillanceMetadata.columns;
const surveillanceDetailFields = surveillanceMetadata.detailFields;
const surveillanceFacets = surveillanceMetadata.facets;

export const surveillanceCollectionProfile: ResourceCollectionProfile<SurveillanceViewRecord> =
  {
    resource: "surveillance",
    label: "Surveillance",
    idField: "id",
    columns: surveillanceColumns,
    detailFields: surveillanceDetailFields,
    basePredicate: "eq(id,*)",
    guideUrl:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/surveillance_data.html",
    buildStructuralRql: surveillanceStructuralRql,
    facets: surveillanceFacets,
    rowHref: (row) =>
      surveillanceHref(
        row.sample_identifier,
        row.pathogen_test_type?.length === 1
          ? row.pathogen_test_type[0]
          : undefined,
      ),
    rowLinkField: "sample_identifier",
  };
