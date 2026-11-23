import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import { describeEmptyView, MapEmptyState } from "../map-empty-state";
import type { GeoMapState } from "../types";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function distribution(
  stateData: Record<string, number> = {},
  countyError?: string,
): OrganismGeoDistribution {
  return {
    countryData: {},
    countryMeta: {},
    stateData,
    stateMeta: {},
    countyData: {},
    countyMeta: {},
    ...(countyError ? { countyError } : {}),
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

  it("says how many genomes the state has when county data is unavailable", () => {
    expect(describeEmptyView(illinois, distribution({ Illinois: 420 }))).toEqual({
      title: "No county-level data for this taxon.",
      description: "Illinois has 420 genomes, but county-level data is unavailable.",
    });
    expect(describeEmptyView(illinois, distribution({ Illinois: 1 }))).toEqual({
      title: "No county-level data for this taxon.",
      description: "Illinois has 1 genome, but county-level data is unavailable.",
    });
    expect(describeEmptyView(illinois, distribution({ Illinois: 4647 })).description).toBe(
      "Illinois has 4,647 genomes, but county-level data is unavailable.",
    );
  });

  it("says so when the taxon has no genomes in the state", () => {
    expect(describeEmptyView(illinois, distribution({ Texas: 9 }))).toEqual({
      title: "No data for Illinois.",
      description: "No genome count is available for Illinois.",
    });
  });

  it("says the county query failed, with the upstream message, when the state has genomes", () => {
    expect(
      describeEmptyView(
        illinois,
        distribution({ Illinois: 420 }, "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: busy)."),
      ),
    ).toEqual({
      title: "County data could not be loaded.",
      description: "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: busy).",
      failed: true,
    });
  });

  it("does not blame the county query for a state without genomes", () => {
    expect(
      describeEmptyView(illinois, distribution({ Texas: 9 }, "county failed")),
    ).toEqual({
      title: "No data for Illinois.",
      description: "No genome count is available for Illinois.",
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
          description: "Illinois has 420 genomes, but county-level data is unavailable.",
        }}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No county-level data for this taxon.");
    expect(status).toHaveTextContent("Illinois has 420 genomes, but county-level data is unavailable.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets pointer events through to the map", () => {
    render(<MapEmptyState message={null} />);

    expect(screen.getByRole("status")).toHaveClass("pointer-events-none");
  });

  it("shows a failed message as a destructive alert with a Retry the pointer can reach", async () => {
    render(
      <MapEmptyState
        message={{
          title: "County data could not be loaded.",
          description: "county failed",
          failed: true,
        }}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("County data could not be loaded.");
    expect(status).toHaveTextContent("county failed");
    const retry = within(status).getByRole("button", { name: "Retry" });
    expect(retry.closest(".pointer-events-auto")).not.toBeNull();

    fireEvent.click(retry);
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });
});
