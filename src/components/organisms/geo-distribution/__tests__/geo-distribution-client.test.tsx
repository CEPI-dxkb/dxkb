import { fireEvent, render, screen } from "@testing-library/react";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import { GeoDistributionClient } from "../geo-distribution-client";
import { MapTooltip } from "../map-tooltip";

const useQueryMock = vi.fn((_options: unknown) => ({
  data: null,
  error: null,
  isLoading: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("@visx/tooltip", () => ({
  TooltipWithBounds: () => null,
  useTooltip: () => ({
    tooltipOpen: false,
    tooltipLeft: 0,
    tooltipTop: 0,
    tooltipData: null,
    showTooltip: vi.fn(),
    hideTooltip: vi.fn(),
  }),
}));

vi.mock("../choropleth-svg", () => ({
  ChoroplethSvg: ({ mapState }: { mapState: { view: string } }) => (
    <div data-testid="map-view">{mapState.view}</div>
  ),
}));

function distribution({
  countryData = { "South Korea": 3 },
  stateData = {},
  countyData = {},
}: Partial<
  Pick<
    OrganismGeoDistribution,
    "countryData" | "stateData" | "countyData"
  >
> = {}): OrganismGeoDistribution {
  return {
    countryData,
    countryMeta: {},
    stateData,
    stateMeta: {},
    countyData,
    countyMeta: {},
  };
}

describe("GeoDistributionClient", () => {
  it("describes an empty map region as having no data", () => {
    render(
      <MapTooltip
        data={{
          view: "world",
          name: "France",
          count: 0,
          genera: {},
          hosts: {},
        }}
      />,
    );

    expect(screen.getByText("France")).toBeVisible();
    expect(screen.getByText("No data available")).toBeVisible();
  });

  it("does not request state topology when World is the default", () => {
    render(<GeoDistributionClient data={distribution()} accent="bacteria" />);

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["geo-distribution", "states-topo"],
        enabled: false,
      }),
    );
  });

  it.each([
    {
      name: "country-only data",
      data: distribution(),
    },
    {
      name: "a USA country aggregate without state-level data",
      data: distribution({ countryData: { USA: 3 } }),
    },
    {
      name: "county data without state-level data",
      data: distribution({ countyData: { "Wyoming|Park": 3 } }),
    },
    {
      name: "only zero-valued state buckets",
      data: distribution({ stateData: { Wyoming: 0 } }),
    },
  ])("defaults to the World view for $name", ({ data }) => {
    render(<GeoDistributionClient data={data} accent="bacteria" />);

    expect(screen.getByTestId("map-view")).toHaveTextContent("world");
    expect(screen.getByRole("button", { name: "World" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it.each([
    {
      name: "US-only data",
      data: distribution({ countryData: {}, stateData: { Wyoming: 3 } }),
    },
    {
      name: "mixed world and US data",
      data: distribution({ stateData: { Wyoming: 3 } }),
    },
  ])("defaults to the United States view for $name", ({ data }) => {
    render(<GeoDistributionClient data={data} accent="bacteria" />);

    expect(screen.getByTestId("map-view")).toHaveTextContent("us");
    expect(
      screen.getByRole("button", { name: "United States" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("still allows switching to the United States view when World is the default", () => {
    render(<GeoDistributionClient data={distribution()} accent="bacteria" />);

    fireEvent.click(screen.getByRole("button", { name: "United States" }));

    expect(screen.getByTestId("map-view")).toHaveTextContent("us");
    expect(screen.getByText("No US state-level data for this taxon.")).toBeVisible();
  });

  it("still allows switching to the World view when United States is the default", () => {
    render(
      <GeoDistributionClient
        data={distribution({ stateData: { Wyoming: 3 } })}
        accent="bacteria"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "World" }));

    expect(screen.getByTestId("map-view")).toHaveTextContent("world");
  });

  it("scales each view to its own regions and says what a count is", () => {
    render(
      <GeoDistributionClient
        data={distribution({
          countryData: { USA: 1_000_000, China: 50_000 },
          stateData: { Wyoming: 3, Idaho: 300 },
        })}
        accent="viruses"
      />,
    );

    // The US view's steps end at the top state, not the USA's national total.
    const usLegend = screen.getByRole("img", { name: /^Genomes per state:/ });
    expect(usLegend).toHaveAccessibleName(/to 300/);
    expect(usLegend).not.toHaveAccessibleName(/1,000,000/);
    expect(screen.getByText("300")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "World" }));

    expect(
      screen.getByRole("img", { name: /^Genomes per country:/ }),
    ).toHaveAccessibleName(/to 1,000,000/);
    expect(screen.getByText("1M")).toBeInTheDocument();
  });

  it("scales the State view to the selected state's counties", () => {
    render(
      <GeoDistributionClient
        data={distribution({
          stateData: { Illinois: 60 },
          countyData: { "Illinois|Cook": 50, "Illinois|Lake": 5, "Texas|Harris": 9999 },
        })}
        accent="bacteria"
      />,
    );

    // The State view opens on Illinois.
    fireEvent.click(screen.getByRole("button", { name: "State" }));

    const legend = screen.getByRole("img", { name: /^Genomes per county:/ });
    expect(legend).toHaveAccessibleName(/to 50/);
    expect(legend).not.toHaveAccessibleName(/9,999/);
  });

  it("shows the No data swatch even when a view has no counts", () => {
    render(
      <GeoDistributionClient
        data={distribution({ countryData: {} })}
        accent="bacteria"
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Genomes per country: No data: no genomes.",
      }),
    ).toHaveTextContent("No data");
  });
});
