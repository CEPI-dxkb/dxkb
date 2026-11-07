import { render, screen } from "@testing-library/react";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import { LazyGeoDistributionClient } from "../lazy-geo-distribution-client";

vi.mock("../geo-distribution-client", () => ({
  GeoDistributionClient: (props: { accent: string }) => (
    <div data-testid="geo-distribution-client" data-accent={props.accent} />
  ),
}));

const data: OrganismGeoDistribution = {
  countryData: {},
  countryMeta: {},
  stateData: {},
  stateMeta: {},
  countyData: {},
  countyMeta: {},
};

describe("LazyGeoDistributionClient", () => {
  it("renders the map client with its props once the import resolves", async () => {
    render(<LazyGeoDistributionClient data={data} accent="viruses" />);

    expect(await screen.findByTestId("geo-distribution-client")).toHaveAttribute(
      "data-accent",
      "viruses",
    );
  });
});
