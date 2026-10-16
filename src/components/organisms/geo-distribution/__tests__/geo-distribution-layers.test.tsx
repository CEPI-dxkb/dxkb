import { render } from "@testing-library/react";
import type { RefObject } from "react";
import { UsStatesLayer } from "../us-states-layer";
import { StateCountiesLayer } from "../state-counties-layer";
import { WorldCountriesLayer } from "../world-countries-layer";
import { ChoroplethPath } from "../choropleth-path";
import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";
import type { StateFeature } from "../topology-utils";

// Replace @visx/geo projection components with a minimal stub that calls the
// render-prop children directly with the supplied features. This lets us test
// the layer logic (meta lookup, fallback) without SVG projection math.
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
    children: (arg: { features: { feature: unknown; path: string }[] }) => unknown;
  }) => children({ features: data.map((feature) => ({ feature, path: "M0,0" })) }),
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
    // Previously crashed: `meta.genera` where `meta` was undefined
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
      />,
    );

    expect(mockChoroplethPath.mock.calls[0][0]).toMatchObject({
      payload: { genera: {}, hosts: {} },
    });
  });
});
