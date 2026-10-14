import {
  genomeScopeFromProps,
  type GenomeScopeProps,
} from "@/components/organisms/shared/genome-scope-props";
import { describeGenomeScope } from "@/lib/services/organisms/genome-scope";
import { fetchOrganismGeoDistribution } from "@/lib/services/organisms/geo-distribution";

import { GeoDistributionClient } from "./geo-distribution-client";
import type { GeoDistributionAccent } from "./types";

type GeoDistributionProps = GenomeScopeProps & {
  accent: GeoDistributionAccent;
};

export async function GeoDistribution({ accent, ...scopeProps }: GeoDistributionProps) {
  const scope = genomeScopeFromProps(scopeProps);
  const data = await fetchOrganismGeoDistribution(scope);

  return (
    <GeoDistributionClient
      key={describeGenomeScope(scope)}
      data={data}
      accent={accent}
    />
  );
}
