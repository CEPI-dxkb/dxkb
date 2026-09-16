import type { ResourceCollectionProfile } from "@/components/views";
import { serologyHref } from "@/lib/views/hrefs";
import { serologyMetadata } from "./fields";
import { serologyStructuralRql } from "./query";
import type { SerologyViewRecord } from "./schema";

const serologyColumns = serologyMetadata.columns;
const serologyDetailFields = serologyMetadata.detailFields;
const serologyFacets = serologyMetadata.facets;

export const serologyCollectionProfile: ResourceCollectionProfile<SerologyViewRecord> =
  {
    resource: "serology",
    label: "Serology",
    idField: "id",
    columns: serologyColumns,
    detailFields: serologyDetailFields,
    defaultSort: "unsorted",
    basePredicate: "eq(id,*)",
    guideUrl:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/serology_data.html",
    buildStructuralRql: serologyStructuralRql,
    facets: serologyFacets,
    rowHref: (row) => serologyHref(row.sample_identifier, row.test_type),
    rowLinkField: "sample_identifier",
  };
