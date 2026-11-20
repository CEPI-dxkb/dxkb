import { render, screen } from "@testing-library/react";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import { describeEmptyView, MapEmptyState } from "../map-empty-state";
import type { GeoMapState } from "../types";

function distribution(
  stateData: Record<string, number> = {},
): OrganismGeoDistribution {
  return {
    countryData: {},
    countryMeta: {},
    stateData,
    stateMeta: {},
    countyData: {},
    countyMeta: {},
  };
}

const illinois: GeoMapState = {
  view: "state",
  selectedStateFips: "17",
  selectedStateName: "Illinois",
};

describe("describeEmptyView", () => {
  it("keeps the world and US sentences", () => {
    expect(
      describeEmptyView(
        { view: "world", selectedStateFips: null, selectedStateName: null },
        distribution(),
      ),
    ).toEqual({ title: "No country-level data for this taxon.", description: null });
    expect(
      describeEmptyView(
        { view: "us", selectedStateFips: null, selectedStateName: null },
        distribution(),
      ),
    ).toEqual({ title: "No US state-level data for this taxon.", description: null });
  });

  it("says how many genomes the state has when none record a county", () => {
    expect(describeEmptyView(illinois, distribution({ Illinois: 420 }))).toEqual({
      title: "No county-level data for this taxon.",
      description: "Illinois has 420 genomes, but none record a county.",
    });
    expect(describeEmptyView(illinois, distribution({ Illinois: 1 }))).toEqual({
      title: "No county-level data for this taxon.",
      description: "Illinois has 1 genome, but it records no county.",
    });
    expect(describeEmptyView(illinois, distribution({ Illinois: 4647 })).description).toBe(
      "Illinois has 4,647 genomes, but none record a county.",
    );
  });

  it("says so when the taxon has no genomes in the state", () => {
    expect(describeEmptyView(illinois, distribution({ Texas: 9 }))).toEqual({
      title: "No data for Illinois.",
      description: "No genomes are recorded for Illinois.",
    });
  });
});

describe("MapEmptyState", () => {
  it("keeps an empty live region mounted without a message", () => {
    render(<MapEmptyState message={null} />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("announces the message inside the live region", () => {
    render(
      <MapEmptyState
        message={{
          title: "No county-level data for this taxon.",
          description: "Illinois has 420 genomes, but none record a county.",
        }}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No county-level data for this taxon.");
    expect(status).toHaveTextContent("Illinois has 420 genomes, but none record a county.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets pointer events through to the map", () => {
    render(<MapEmptyState message={null} />);

    expect(screen.getByRole("status")).toHaveClass("pointer-events-none");
  });
});
