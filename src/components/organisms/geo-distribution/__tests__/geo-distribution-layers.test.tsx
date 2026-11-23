import { render } from "@testing-library/react";
import type { RefObject } from "react";
import { UsStatesLayer } from "../us-states-layer";
import { StateCountiesLayer } from "../state-counties-layer";
import { WorldCountriesLayer } from "../world-countries-layer";
import { ChoroplethPath } from "../choropleth-path";
import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";
import type { StateFeature } from "../topology-utils";

// Stub @visx/geo to call render-prop children with the supplied features,
// avoiding SVG projection math.
vi.mock("@visx/geo", () => ({
  AlbersUsa: ({
    data,
    children,
  }: {
    data: unknown[];
    children: (arg: { features: { feature: unknown; path: string }[] }) => unknown;
  }) => children({ features: data.map((feature) => ({ feature, path: "M0,0" })) }),
  NaturalEarth: ({
    data,
    children,
  }: {
    data: unknown[];
    children: (arg: {
      features: { feature: unknown; path: string }[];
      projection: unknown;
    }) => unknown;
  }) =>
    children({
      features: data.map((feature) => ({ feature, path: "M0,0" })),
      projection: {},
    }),
  CustomProjection: ({
    data,
    children,
  }: {
    data: unknown[];
    children: (arg: { features: { feature: unknown; path: string }[] }) => unknown;
  }) => children({ features: data.map((feature) => ({ feature, path: "M0,0" })) }),
}));

vi.mock("../choropleth-path", () => ({
  ChoroplethPath: vi.fn(() => null),
}));

vi.mock("../zoom-to-feature", () => ({
  countryBounds: vi.fn(() => [
    [0, 0],
    [10, 10],
  ]),
}));

const mockChoroplethPath = vi.mocked(ChoroplethPath);

function makeFeature(name: string): StateFeature {
  return {
    type: "Feature",
    id: "1",
    properties: { name },
    geometry: { type: "Point", coordinates: [0, 0] },
  };
}

const emptyGeoData: OrganismGeoDistribution = {
  countryData: {},
  countryMeta: {},
  stateData: {},
  stateMeta: {},
  countyData: {},
  countyMeta: {},
};

const colorScale = () => "#000";
const makeRef = <T,>(v: T): RefObject<T> => ({ current: v });
const noop = () => void 0;

beforeEach(() => {
  mockChoroplethPath.mockClear();
});

describe("UsStatesLayer", () => {
  it("renders without crashing when a state has no stateMeta entry", () => {
    expect(() =>
      render(
        <UsStatesLayer
          stateFeatures={[makeFeature("Texas")]}
          scale={800}
          width={960}
          height={560}
          data={emptyGeoData}
          colorScale={colorScale}
          isDraggingRef={makeRef(false)}
          onHoverEnter={noop as never}
          onHoverLeave={noop}
          onSelectState={noop}
        />,
      ),
    ).not.toThrow();
  });

  it("passes empty genera and hosts when stateMeta key is absent", () => {
    render(
      <UsStatesLayer
        stateFeatures={[makeFeature("Texas")]}
        scale={800}
        width={960}
        height={560}
        data={emptyGeoData}
        colorScale={colorScale}
        isDraggingRef={makeRef(false)}
        onHoverEnter={noop as never}
        onHoverLeave={noop}
        onSelectState={noop}
      />,
    );

    expect(mockChoroplethPath.mock.calls[0][0]).toMatchObject({
      payload: { genera: {}, hosts: {} },
    });
  });

  it("is not drillable when no onSelectState is given", () => {
    render(
      <UsStatesLayer
        stateFeatures={[makeFeature("Texas")]}
        scale={800}
        width={960}
        height={560}
        data={emptyGeoData}
        colorScale={colorScale}
        isDraggingRef={makeRef(false)}
        onHoverEnter={noop as never}
        onHoverLeave={noop}
      />,
    );

    expect(mockChoroplethPath.mock.calls[0][0]).toMatchObject({
      cursor: "default",
      onClick: undefined,
    });
  });

  it("drills into a state on click when onSelectState is given", () => {
    const onSelectState = vi.fn();
    render(
      <UsStatesLayer
        stateFeatures={[makeFeature("Texas")]}
        scale={800}
        width={960}
        height={560}
        data={emptyGeoData}
        colorScale={colorScale}
        isDraggingRef={makeRef(false)}
        onHoverEnter={noop as never}
        onHoverLeave={noop}
        onSelectState={onSelectState}
      />,
    );

    const props = mockChoroplethPath.mock.calls[0][0];
    expect(props.cursor).toBe("pointer");
    props.onClick?.();
    // makeFeature gives every feature id "1", which the layer pads to "01".
    expect(onSelectState).toHaveBeenCalledWith("01", "Texas");
  });
});

describe("StateCountiesLayer", () => {
  const fitExtent: [[number, number], [number, number]] = [[0, 0], [960, 560]];

  it("renders without crashing when a county has no countyMeta entry", () => {
    const feature = makeFeature("Travis");
    expect(() =>
      render(
        <StateCountiesLayer
          countyFeatures={[feature]}
          fitBoundsFeatures={[feature]}
          fitExtent={fitExtent}
          data={emptyGeoData}
          colorScale={colorScale}
          isDraggingRef={makeRef(false)}
          onHoverEnter={noop as never}
          onHoverLeave={noop}
          selectedStateName="Texas"
        />,
      ),
    ).not.toThrow();
  });

  it("passes empty genera and hosts when countyMeta key is absent", () => {
    const feature = makeFeature("Travis");
    render(
      <StateCountiesLayer
        countyFeatures={[feature]}
        fitBoundsFeatures={[feature]}
        fitExtent={fitExtent}
        data={emptyGeoData}
        colorScale={colorScale}
        isDraggingRef={makeRef(false)}
        onHoverEnter={noop as never}
        onHoverLeave={noop}
        selectedStateName="Texas"
      />,
    );

    expect(mockChoroplethPath.mock.calls[0][0]).toMatchObject({
      payload: { genera: {}, hosts: {} },
    });
  });
});

describe("WorldCountriesLayer", () => {
  it("renders without crashing when a country has no countryMeta entry", () => {
    expect(() =>
      render(
        <WorldCountriesLayer
          countryFeatures={[makeFeature("France")]}
          scale={800}
          width={960}
          height={560}
          data={emptyGeoData}
          colorScale={colorScale}
          isDraggingRef={makeRef(false)}
          onHoverEnter={noop as never}
          onHoverLeave={noop}
          onSwitchToUs={noop}
          onZoomToBounds={noop}
        />,
      ),
    ).not.toThrow();
  });

  it("passes empty genera and hosts when countryMeta key is absent", () => {
    render(
      <WorldCountriesLayer
        countryFeatures={[makeFeature("France")]}
        scale={800}
        width={960}
        height={560}
        data={emptyGeoData}
        colorScale={colorScale}
        isDraggingRef={makeRef(false)}
        onHoverEnter={noop as never}
        onHoverLeave={noop}
        onSwitchToUs={noop}
        onZoomToBounds={noop}
      />,
    );

    expect(mockChoroplethPath.mock.calls[0][0]).toMatchObject({
      payload: { genera: {}, hosts: {} },
    });
  });

  it("zooms to a country's bounds on click, but still switches to the US view for the USA", () => {
    const onZoomToBounds = vi.fn();
    const onSwitchToUs = vi.fn();
    render(
      <WorldCountriesLayer
        countryFeatures={[
          { ...makeFeature("Germany"), id: "276" },
          { ...makeFeature("United States of America"), id: "840" },
        ]}
        scale={800}
        width={960}
        height={560}
        data={emptyGeoData}
        colorScale={colorScale}
        isDraggingRef={makeRef(false)}
        onHoverEnter={noop as never}
        onHoverLeave={noop}
        onSwitchToUs={onSwitchToUs}
        onZoomToBounds={onZoomToBounds}
      />,
    );

    const calls = mockChoroplethPath.mock.calls.map(([props]) => props);
    const germany = calls.find((props) => props.payload.name === "Germany");
    const usa = calls.find(
      (props) => props.payload.name === "United States of America",
    );
    expect(germany).toMatchObject({ cursor: "pointer", dataRegion: "Germany" });
    expect(usa).toMatchObject({ cursor: "pointer" });
    germany?.onClick?.();
    expect(onZoomToBounds).toHaveBeenCalledWith([
      [0, 0],
      [10, 10],
    ]);
    usa?.onClick?.();
    expect(onSwitchToUs).toHaveBeenCalledTimes(1);
    expect(onZoomToBounds).toHaveBeenCalledTimes(1);
  });
});
