import { fireEvent, render, screen, within } from "@testing-library/react";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import { GeoDistributionClient } from "../geo-distribution-client";
import { MapTooltip } from "../map-tooltip";

interface QueryState {
  data: null;
  error: Error | null;
  isLoading: boolean;
}

const useQueryMock = vi.fn(
  (_options: unknown): QueryState => ({
    data: null,
    error: null,
    isLoading: false,
  }),
);

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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
  // `clearMocks` only clears call history, so a test that overrides the query
  // mock must not leak its implementation into later tests.
  afterEach(() => {
    useQueryMock.mockImplementation(() => ({
      data: null,
      error: null,
      isLoading: false,
    }));
  });

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

  it("explains an all-grey state that has genomes but no counties", () => {
    render(
      <GeoDistributionClient
        data={distribution({
          stateData: { Illinois: 420 },
          // County rows exist, but only for another state.
          countyData: { "Texas|Harris": 9 },
        })}
        accent="bacteria"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "State" }));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No county-level data for this taxon.");
    expect(status).toHaveTextContent(
      "Illinois has 420 genomes, but county-level data is unavailable.",
    );
  });

  it("says the county query failed instead of that the state has no counties", () => {
    render(
      <GeoDistributionClient
        data={{
          ...distribution({ stateData: { Illinois: 420 } }),
          countyError: "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: busy).",
        }}
        accent="bacteria"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "State" }));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("County data could not be loaded.");
    expect(status).toHaveTextContent(
      "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: busy).",
    );
    expect(status).not.toHaveTextContent("No county-level data");
    expect(within(status).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("holds the county failure back while the county map is loading", () => {
    useQueryMock.mockImplementation((options: unknown) => ({
      data: null,
      error: null,
      isLoading:
        (options as { queryKey: string[] }).queryKey[1] === "counties-topo",
    }));
    render(
      <GeoDistributionClient
        data={{
          ...distribution({ stateData: { Illinois: 420 } }),
          countyError: "county failed",
        }}
        accent="bacteria"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "State" }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says nothing in a state that has county data", () => {
    render(
      <GeoDistributionClient
        data={distribution({
          stateData: { Illinois: 60 },
          countyData: { "Illinois|Cook": 50 },
        })}
        accent="bacteria"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "State" }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("holds the message back while the county map is loading", () => {
    useQueryMock.mockImplementation((options: unknown) => ({
      data: null,
      error: null,
      isLoading:
        (options as { queryKey: string[] }).queryKey[1] === "counties-topo",
    }));
    render(
      <GeoDistributionClient
        data={distribution({ stateData: { Illinois: 420 } })}
        accent="bacteria"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "State" }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("holds the message back when the county map failed to load", () => {
    useQueryMock.mockImplementation((options: unknown) => {
      const failed =
        (options as { queryKey: string[] }).queryKey[1] === "counties-topo";
      return {
        data: null,
        error: failed ? new Error("Could not load county map") : null,
        isLoading: false,
      };
    });
    render(
      <GeoDistributionClient
        data={distribution({ stateData: { Illinois: 420 } })}
        accent="bacteria"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "State" }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
