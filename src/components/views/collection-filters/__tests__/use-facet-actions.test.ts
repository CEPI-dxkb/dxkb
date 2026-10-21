import { act, renderHook } from "@testing-library/react";
import { useFacetActions } from "../use-facet-actions";

type Props = Parameters<typeof useFacetActions>[0];

const definitions = [
  { field: "genome_status", label: "Genome Status" },
  { field: "host_name", label: "Host Name", initiallyVisible: false },
  { field: "species", label: "Species", initiallyVisible: false },
];

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    definitions,
    pinnedFields: new Set(["genome_status"]),
    setFieldPinned: vi.fn(),
    peekedFields: new Set<string>(),
    setPeekedFields: vi.fn(),
    filters: {},
    onFacetsWanted: vi.fn(),
    ...overrides,
  };
}

function renderActions(props: Props, idle = false) {
  return renderHook(
    ({ hookProps, hookIdle }) => useFacetActions(hookProps, hookIdle),
    { initialProps: { hookProps: props, hookIdle: idle } },
  );
}

describe("useFacetActions peek", () => {
  it("counts every given facet outside the pinned set in one write", () => {
    const props = makeProps({ peekedFields: new Set(["species"]) });
    const { result } = renderActions(props);

    act(() => {
      result.current.peek(["host_name", "species", "genome_status", "strain"]);
    });

    expect(props.onFacetsWanted).toHaveBeenCalledOnce();
    expect(props.setPeekedFields).toHaveBeenCalledOnce();
    expect(props.setPeekedFields).toHaveBeenCalledWith(
      new Set(["species", "host_name"]),
    );
  });

  it("asks for the counts but adds nothing for pinned, peeked or unknown fields", () => {
    const props = makeProps({ peekedFields: new Set(["species"]) });
    const { result } = renderActions(props);

    act(() => {
      result.current.peek(["genome_status", "species", "strain"]);
    });

    expect(props.onFacetsWanted).toHaveBeenCalledOnce();
    expect(props.setPeekedFields).not.toHaveBeenCalled();
  });

  it("knows which facets are counted", () => {
    const props = makeProps({ peekedFields: new Set(["species"]) });
    const { result } = renderActions(props);

    expect(result.current.isCounted("genome_status")).toBe(true);
    expect(result.current.isCounted("species")).toBe(true);
    expect(result.current.isCounted("host_name")).toBe(false);
    // Nothing counts a field no facet names; there is nothing to wait for.
    expect(result.current.isCounted("strain")).toBe(true);
  });
});

describe("useFacetActions togglePin", () => {
  it("pins a facet and stops peeking it", () => {
    const props = makeProps({ peekedFields: new Set(["species", "host_name"]) });
    const { result } = renderActions(props);

    expect(result.current.isPinned("host_name")).toBe(false);
    act(() => {
      result.current.togglePin("host_name");
    });

    expect(props.setPeekedFields).toHaveBeenCalledWith(new Set(["species"]));
    expect(props.setFieldPinned).toHaveBeenCalledWith("host_name", true);
  });

  it("unpins a facet but keeps it counted, as a peek, while the menu is open", () => {
    const props = makeProps();
    const { result } = renderActions(props);

    expect(result.current.isPinned("genome_status")).toBe(true);
    act(() => {
      result.current.togglePin("genome_status");
    });

    expect(props.setPeekedFields).toHaveBeenCalledWith(new Set(["genome_status"]));
    expect(props.setFieldPinned).toHaveBeenCalledWith("genome_status", false);
  });

  it("ignores a field no facet names", () => {
    const props = makeProps();
    const { result } = renderActions(props);

    act(() => {
      result.current.togglePin("strain");
    });

    expect(props.setPeekedFields).not.toHaveBeenCalled();
    expect(props.setFieldPinned).not.toHaveBeenCalled();
  });
});

describe("useFacetActions cleanup", () => {
  it("keeps every peek while a menu is open", () => {
    const props = makeProps({ peekedFields: new Set(["species"]) });
    renderActions(props, false);

    expect(props.setPeekedFields).not.toHaveBeenCalled();
  });

  it("drops unfiltered peeks once idle and keeps filtered ones", () => {
    const props = makeProps({
      peekedFields: new Set(["species", "host_name"]),
      filters: { host_name: ["Human"] },
    });
    const { rerender } = renderActions(props, false);

    rerender({ hookProps: props, hookIdle: true });

    expect(props.setPeekedFields).toHaveBeenCalledWith(new Set(["host_name"]));
  });

  it("drops a filtered peek once its filter goes", () => {
    const props = makeProps({
      peekedFields: new Set(["host_name"]),
      filters: { host_name: ["Human"] },
    });
    const { rerender } = renderActions(props, true);
    expect(props.setPeekedFields).not.toHaveBeenCalled();

    rerender({ hookProps: { ...props, filters: {} }, hookIdle: true });

    expect(props.setPeekedFields).toHaveBeenCalledWith(new Set());
  });
});
