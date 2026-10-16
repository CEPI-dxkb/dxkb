import { render, screen } from "@testing-library/react";
import { Suspense } from "react";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";
import { fetchOrganismGeoDistribution } from "@/lib/services/organisms/geo-distribution";

import { GeoDistribution } from "../geo-distribution";

vi.mock("@/lib/services/organisms/geo-distribution", () => ({
  fetchOrganismGeoDistribution: vi.fn(),
}));

vi.mock("../geo-distribution-client", () => ({
  GeoDistributionClient: () => <div data-testid="geo-distribution-client" />,
}));

async function renderServer(node: Promise<React.ReactElement>) {
  render(<Suspense fallback={null}>{await node}</Suspense>);
}

function distribution(count: number): OrganismGeoDistribution {
  return {
    countryData: count > 0 ? { "South Korea": count } : {},
    countryMeta: {},
    stateData: {},
    stateMeta: {},
    countyData: {},
    countyMeta: {},
  };
}

describe("GeoDistribution", () => {
  it("renders the map when no geographic data exists", async () => {
    vi.mocked(fetchOrganismGeoDistribution).mockResolvedValue(distribution(0));

    await renderServer(
      GeoDistribution({ taxonId: 2871700, accent: "bacteria" }),
    );

    expect(screen.getByTestId("geo-distribution-client")).toBeVisible();
  });

  it("renders the map when any geographic data exists", async () => {
    vi.mocked(fetchOrganismGeoDistribution).mockResolvedValue(distribution(3));

    await renderServer(
      GeoDistribution({ taxonId: 2871700, accent: "bacteria" }),
    );

    expect(screen.getByTestId("geo-distribution-client")).toBeVisible();
  });
});
