import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import { GeoDistributionClient } from "../geo-distribution-client";
import { MapTooltip } from "../map-tooltip";
import type { TopologyLike } from "../topology-utils";

interface QueryState {
  data: unknown;
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

const zoomToCountryMock = vi.fn((_name: string) => true);

vi.mock("../choropleth-svg", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    ChoroplethSvg: forwardRef(function ChoroplethSvgMock(
      {
        mapState,
        onSelectState,
      }: {
        mapState: { view: string };
        onSelectState?: (fips: string, name: string) => void;
      },
      ref,
    ) {
      useImperativeHandle(ref, () => ({
        reset: vi.fn(),
        zoomToCountry: (name: string) => zoomToCountryMock(name),
      }));
      return (
        <div data-testid="map-view" data-can-drill={onSelectState ? "yes" : "no"}>
          {mapState.view}
        </div>
      );
    }),
  };
});

const worldTopo = JSON.parse(
  readFileSync(path.join(process.cwd(), "public/maps/countries-110m.json"), "utf8"),
) as TopologyLike;

function loadWorldTopology() {
  useQueryMock.mockImplementation((options: unknown) => ({
    data:
      (options as { queryKey: string[] }).queryKey[1] === "world-topo"
        ? worldTopo
        : null,
    error: null,
    isLoading: false,
  }));
}

// One state is enough for the hidden state select to have an option to pick.
const illinoisTopology = {
  type: "Topology",
  arcs: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
  objects: {
    states: {
      type: "GeometryCollection",
      geometries: [
        {
          type: "Polygon",
          id: "17",
          properties: { name: "Illinois" },
          arcs: [[0]],
        },
      ],
    },
  },
};

function serveStatesTopology() {
  useQueryMock.mockImplementation((options: unknown) => ({
    data:
      (options as { queryKey: string[] }).queryKey[1] === "states-topo"
        ? illinoisTopology
        : null,
    error: null,
    isLoading: false,
  }));
}

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

// `clearMocks` only clears call history, so a test that overrides the query
// mock must not leak its implementation into later tests.
afterEach(() => {
  useQueryMock.mockImplementation(() => ({
    data: null,
    error: null,
    isLoading: false,
  }));
});

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

  it("keeps the State pill enabled when the county query failed, so its failure can be opened", () => {
    render(
      <GeoDistributionClient
        data={{
          ...distribution({ stateData: { Illinois: 420 } }),
          countyError: "county failed",
        }}
        accent="bacteria"
      />,
    );

    const pill = screen.getByRole("button", { name: "State" });
    expect(pill).toBeEnabled();
    expect(pill).not.toHaveAccessibleDescription(
      "County-level data is not available for this taxon.",
    );
    expect(screen.getByTestId("map-view")).toHaveAttribute(
      "data-can-drill",
      "yes",
    );

    fireEvent.click(pill);

    expect(screen.getByTestId("map-view")).toHaveTextContent(/^state$/);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("County data could not be loaded.");
    expect(status).toHaveTextContent("county failed");
    expect(within(status).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("stays on the county failure when a refresh fails the county query", () => {
    const { rerender } = render(
      <GeoDistributionClient
        data={distribution({
          stateData: { Illinois: 420 },
          countyData: { "Illinois|Cook": 50 },
        })}
        accent="bacteria"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "State" }));

    rerender(
      <GeoDistributionClient
        data={{
          ...distribution({ stateData: { Illinois: 420 } }),
          countyError: "county failed",
        }}
        accent="bacteria"
      />,
    );

    expect(screen.getByTestId("map-view")).toHaveTextContent(/^state$/);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("County data could not be loaded.");
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
        data={distribution({
          stateData: { Illinois: 420 },
          countyData: { "Texas|Harris": 9 },
        })}
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
        data={distribution({
          stateData: { Illinois: 420 },
          countyData: { "Texas|Harris": 9 },
        })}
        accent="bacteria"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "State" }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("disables the State pill and blocks state drill-down when no county has genomes", () => {
    render(
      <GeoDistributionClient
        data={distribution({ stateData: { Illinois: 420 } })}
        accent="bacteria"
      />,
    );

    const pill = screen.getByRole("button", { name: "State" });
    expect(pill).toBeDisabled();
    expect(pill).toHaveAccessibleDescription(
      "County-level data is not available for this taxon.",
    );
    expect(screen.getByTestId("map-view")).toHaveAttribute(
      "data-can-drill",
      "no",
    );

    // A disabled button never fires click, so this guard only matters if the
    // pill's own disabled state ever regresses; handleViewChange also returns
    // early (defense in depth), and the next test covers the path that does
    // reach the client.
    fireEvent.click(pill);
    expect(screen.getByTestId("map-view")).toHaveTextContent("us");
  });

  it("keeps the state-select guard closed while the State view is gated", async () => {
    serveStatesTopology();
    render(
      <GeoDistributionClient
        data={distribution({ stateData: { Illinois: 420 } })}
        accent="bacteria"
      />,
    );
    const user = userEvent.setup();

    // In a browser the hidden select is `inert`, so nobody can reach it. jsdom
    // does not implement `inert`, which lets this test pick a state anyway and
    // check the `handleSelectState` guard behind it (defense in depth).
    await user.click(screen.getByRole("combobox", { name: "View state" }));
    await user.click(await screen.findByRole("option", { name: "Illinois" }));

    expect(screen.getByTestId("map-view")).toHaveTextContent("us");
  });

  it("lets the state-select guard through once a county has genomes", async () => {
    serveStatesTopology();
    render(
      <GeoDistributionClient
        data={distribution({
          stateData: { Illinois: 420 },
          countyData: { "Texas|Harris": 9 },
        })}
        accent="bacteria"
      />,
    );
    const user = userEvent.setup();

    // jsdom ignores `inert`, so the select is reachable from the US view here;
    // in a browser it is only usable in the State view. This checks that
    // `handleSelectState` opens a state when the view is not gated.
    await user.click(screen.getByRole("combobox", { name: "View state" }));
    await user.click(await screen.findByRole("option", { name: "Illinois" }));

    expect(screen.getByTestId("map-view")).toHaveTextContent("state");
  });

  it.each<{
    name: string;
    stateData: Record<string, number>;
    fallbackView: string;
    fallbackPill: string;
  }>([
    {
      name: "the United States view when a state has genomes",
      stateData: { Illinois: 420 },
      fallbackView: "us",
      fallbackPill: "United States",
    },
    {
      name: "the World view when no state has genomes",
      stateData: {},
      fallbackView: "world",
      fallbackPill: "World",
    },
  ])(
    "leaves the State view for $name when a refresh drops the county data",
    ({ stateData, fallbackView, fallbackPill }) => {
      const { rerender } = render(
        <GeoDistributionClient
          data={distribution({
            stateData: { Illinois: 420 },
            countyData: { "Texas|Harris": 9 },
          })}
          accent="bacteria"
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "State" }));
      expect(screen.getByTestId("map-view")).toHaveTextContent("state");

      // Same scope, same mounted instance: a retry re-renders the server
      // component, and the county pivot answers with no county genomes.
      rerender(
        <GeoDistributionClient
          data={distribution({ stateData, countyData: {} })}
          accent="bacteria"
        />,
      );

      expect(screen.getByTestId("map-view")).toHaveTextContent(
        new RegExp(`^${fallbackView}$`),
      );
      expect(screen.getByRole("button", { name: fallbackPill })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const statePill = screen.getByRole("button", { name: "State" });
      expect(statePill).toBeDisabled();
      expect(statePill).toHaveAttribute("aria-pressed", "false");
    },
  );

  it("shows the State view again when the county data returns", () => {
    const withCounties = distribution({
      stateData: { Illinois: 420 },
      countyData: { "Texas|Harris": 9 },
    });
    const { rerender } = render(
      <GeoDistributionClient data={withCounties} accent="bacteria" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "State" }));

    rerender(
      <GeoDistributionClient
        data={distribution({ stateData: { Illinois: 420 } })}
        accent="bacteria"
      />,
    );
    expect(screen.getByTestId("map-view")).toHaveTextContent(/^us$/);

    rerender(<GeoDistributionClient data={withCounties} accent="bacteria" />);
    expect(screen.getByTestId("map-view")).toHaveTextContent(/^state$/);
  });

  it("lets a state be drilled into once any county has genomes", () => {
    render(
      <GeoDistributionClient
        data={distribution({
          stateData: { Illinois: 420 },
          countyData: { "Texas|Harris": 9 },
        })}
        accent="bacteria"
      />,
    );

    expect(screen.getByRole("button", { name: "State" })).toBeEnabled();
    expect(screen.getByTestId("map-view")).toHaveAttribute(
      "data-can-drill",
      "yes",
    );
  });
});

describe("Zoom to country wiring", () => {
  it("offers the countries with data once the world map has loaded, and zooms on a pick", async () => {
    loadWorldTopology();
    const user = userEvent.setup();
    render(
      <GeoDistributionClient
        data={distribution({ countryData: { "South Korea": 3, "Russian Federation": 1, Germany: 0 } })}
        accent="bacteria"
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Zoom to country" }));
    expect(
      (await screen.findAllByRole("option")).map((option) => option.textContent),
    ).toEqual(["Russia", "South Korea"]);
    // Russia's data key is "Russian Federation": the call must carry the topology name.
    await user.click(screen.getByRole("option", { name: "Russia" }));
    expect(zoomToCountryMock).toHaveBeenCalledWith("Russia");
  });

  it("has no country Select before the world map loads", () => {
    render(<GeoDistributionClient data={distribution()} accent="bacteria" />);
    expect(
      screen.queryByRole("combobox", { name: "Zoom to country" }),
    ).not.toBeInTheDocument();
  });

  it("drops the country Select when the United States view is chosen", () => {
    loadWorldTopology();
    render(<GeoDistributionClient data={distribution()} accent="bacteria" />);
    expect(screen.getByRole("combobox", { name: "Zoom to country" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "United States" }));
    expect(
      screen.queryByRole("combobox", { name: "Zoom to country" }),
    ).not.toBeInTheDocument();
  });
});
