import { isChildCollectionParam } from "@/lib/views/child-collection-state";

import {
  applyInteractionsGraphUrlState,
  cameraUrlView,
  defaultInteractionsGraphUrlState,
  interactionsGraphUrlParams,
  liveTabScope,
  parseInteractionsGraphUrlState,
  writeInteractionsGraphUrlState,
} from "../url-state";

describe("Interactions Table/Graph URL state", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("reads the defaults from a bare URL", () => {
    expect(parseInteractionsGraphUrlState(new URLSearchParams())).toEqual(
      defaultInteractionsGraphUrlState,
    );
    expect(defaultInteractionsGraphUrlState).toEqual({
      view: "table",
      keyword: "",
      selected: null,
      layout: "forceatlas2",
      camera: null,
    });
  });

  it("reads the interactionsGraph.* params", () => {
    expect(
      parseInteractionsGraphUrlState(
        new URLSearchParams(
          "interactionsGraph.view=graph&interactionsGraph.q=dnaK&interactionsGraph.node=fig%7C584.1.peg.7",
        ),
      ),
    ).toEqual({
      view: "graph",
      keyword: "dnaK",
      selected: { kind: "node", id: "fig|584.1.peg.7" },
      layout: "forceatlas2",
      camera: null,
    });
    expect(
      parseInteractionsGraphUrlState(
        new URLSearchParams("interactionsGraph.edge=ppi-1"),
      ).selected,
    ).toEqual({ kind: "edge", id: "ppi-1" });
  });

  it("falls back to the defaults for values the UI never writes", () => {
    expect(
      parseInteractionsGraphUrlState(
        new URLSearchParams(
          "interactionsGraph.view=chart&interactionsGraph.node=&interactionsGraph.edge=",
        ),
      ),
    ).toEqual(defaultInteractionsGraphUrlState);
  });

  it("reads one selection when a hand-edited URL names both a node and an edge", () => {
    expect(
      parseInteractionsGraphUrlState(
        new URLSearchParams(
          "interactionsGraph.edge=ppi-1&interactionsGraph.node=peg.1",
        ),
      ).selected,
    ).toEqual({ kind: "node", id: "peg.1" });
  });

  it("does not read the Table's interactions.* params", () => {
    expect(
      parseInteractionsGraphUrlState(
        new URLSearchParams("interactions.keyword=dnaK&interactions.page=2"),
      ),
    ).toEqual(defaultInteractionsGraphUrlState);
  });

  it("writes only the changed fields, omitting defaults, and keeps other params", () => {
    const params = new URLSearchParams(
      "tab=interactions&interactions.page=2&interactionsGraph.q=old",
    );
    applyInteractionsGraphUrlState(params, {
      view: "graph",
      selected: { kind: "node", id: "peg.1" },
    });
    expect([...params]).toEqual([
      ["tab", "interactions"],
      ["interactions.page", "2"],
      ["interactionsGraph.q", "old"],
      ["interactionsGraph.view", "graph"],
      ["interactionsGraph.node", "peg.1"],
    ]);

    applyInteractionsGraphUrlState(params, {
      view: "table",
      keyword: "",
      selected: null,
    });
    expect([...params]).toEqual([
      ["tab", "interactions"],
      ["interactions.page", "2"],
    ]);
  });

  it("keeps one selection param: a node replaces an edge and back", () => {
    const params = new URLSearchParams("interactionsGraph.edge=ppi-1");
    applyInteractionsGraphUrlState(params, {
      selected: { kind: "node", id: "peg.1" },
    });
    expect([...params]).toEqual([["interactionsGraph.node", "peg.1"]]);
    applyInteractionsGraphUrlState(params, {
      selected: { kind: "edge", id: "ppi-2" },
    });
    expect([...params]).toEqual([["interactionsGraph.edge", "ppi-2"]]);
  });

  it("replaces the history entry on the live URL, keeping the hash and readable values", () => {
    window.history.replaceState(
      null,
      "",
      "/taxonomy/584?tab=interactions&interactions.page=2#view_tab=interactions",
    );
    const lengthBefore = window.history.length;
    const replace = vi.spyOn(window.history, "replaceState");
    const push = vi.spyOn(window.history, "pushState");
    try {
      writeInteractionsGraphUrlState({
        view: "graph",
        selected: { kind: "node", id: "fig|584.1.peg.7" },
      });
      expect(push).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledTimes(1);
      expect(window.history.length).toBe(lengthBefore);
      expect(window.location.pathname).toBe("/taxonomy/584");
      expect(window.location.search).toBe(
        "?tab=interactions&interactions.page=2&interactionsGraph.view=graph&interactionsGraph.node=fig%7C584.1.peg.7",
      );
      expect(window.location.hash).toBe("#view_tab=interactions");
    } finally {
      replace.mockRestore();
      push.mockRestore();
    }
  });

  it("writes nothing when the address would not change", () => {
    window.history.replaceState(null, "", "/?interactionsGraph.view=graph");
    const replace = vi.spyOn(window.history, "replaceState");
    try {
      writeInteractionsGraphUrlState({ view: "graph", selected: null });
      expect(replace).not.toHaveBeenCalled();
    } finally {
      replace.mockRestore();
    }
  });

  it("is tab-owned state that a tab switch clears", () => {
    for (const name of Object.values(interactionsGraphUrlParams)) {
      expect(isChildCollectionParam(name)).toBe(true);
    }
  });

  it("reads an offered layout and falls back to the default for anything else", () => {
    expect(
      parseInteractionsGraphUrlState(
        new URLSearchParams("interactionsGraph.layout=circular"),
      ).layout,
    ).toBe("circular");
    for (const value of ["spring", "", "CIRCULAR", "toString"]) {
      expect(
        parseInteractionsGraphUrlState(
          new URLSearchParams(`interactionsGraph.layout=${value}`),
        ).layout,
      ).toBe("forceatlas2");
    }
  });

  it("reads the camera as ratio,x,y", () => {
    expect(
      parseInteractionsGraphUrlState(
        new URLSearchParams("interactionsGraph.cam=0.25,0.4123,-0.1"),
      ).camera,
    ).toEqual({ ratio: 0.25, x: 0.4123, y: -0.1 });
  });

  it.each([
    "garbage",
    "0.5,0.5",
    "0.5,0.5,0.5,0.5",
    "NaN,0.5,0.5",
    "Infinity,0.5,0.5",
    "1e3,0.5,0.5",
    "0x1,0.5,0.5",
    "0,0.5,0.5",
    "-1,0.5,0.5",
    "0.00001,0.5,0.5",
    "1000,0.5,0.5",
    "0.5,99,0.5",
    "0.5,0.5,-99",
    "0.5,,0.5",
    " 0.5,0.5,0.5",
  ])("ignores a camera value it cannot trust: %s", (value) => {
    expect(
      parseInteractionsGraphUrlState(
        new URLSearchParams([["interactionsGraph.cam", value]]),
      ).camera,
    ).toBeNull();
  });

  it("writes the layout and camera readably, omitting the defaults", () => {
    const params = new URLSearchParams("tab=interactions");
    applyInteractionsGraphUrlState(params, {
      layout: "circular",
      camera: { ratio: 0.25, x: 0.4123, y: 0.6 },
    });
    expect([...params]).toEqual([
      ["tab", "interactions"],
      ["interactionsGraph.layout", "circular"],
      ["interactionsGraph.cam", "0.25,0.4123,0.6"],
    ]);

    applyInteractionsGraphUrlState(params, {
      layout: "forceatlas2",
      camera: null,
    });
    expect([...params]).toEqual([["tab", "interactions"]]);
  });

  it("rounds a live camera state and treats the default framing as no camera", () => {
    expect(
      cameraUrlView({ ratio: 0.12345678, x: 0.123456789, y: -0.98766 }),
    ).toEqual({ ratio: 0.123457, x: 0.1235, y: -0.9877 });
    expect(cameraUrlView({ ratio: 0.00123456789, x: 0.5, y: 0.5 })).toEqual({
      ratio: 0.00123457,
      x: 0.5,
      y: 0.5,
    });
    expect(cameraUrlView({ ratio: 1, x: 0.5, y: 0.5 })).toBeNull();
    expect(
      cameraUrlView({ ratio: 1.0000001, x: 0.500002, y: 0.49999 }),
    ).toBeNull();
    expect(cameraUrlView({ ratio: 1e-9, x: 0.5, y: 0.5 })?.ratio).toBe(0.001);
  });

  it("keeps the zoom percent the control shows for a stepped zoom", () => {
    // Three 1.5x zoom-in steps: 100 / ratio is 337.5, where 4 significant digits rounds to 337.
    const ratio = 1 / 1.5 ** 3;
    const view = cameraUrlView({ ratio, x: 0.5, y: 0.4 });
    expect(Math.round(100 / (view?.ratio ?? 1))).toBe(Math.round(100 / ratio));
  });

  it("parses what it writes", () => {
    const camera = cameraUrlView({ ratio: 0.0712, x: 0.31, y: 0.77 });
    const params = new URLSearchParams();
    applyInteractionsGraphUrlState(params, { camera });
    expect(parseInteractionsGraphUrlState(params).camera).toEqual(camera);
  });

  it("names the live page and tab, and nothing else of the query", () => {
    window.history.replaceState(
      null,
      "",
      "/taxonomy/234?tab=interactions&interactionsGraph.q=groEL#x",
    );
    expect(liveTabScope()).toBe("/taxonomy/234?tab=interactions");
    window.history.replaceState(null, "", "/feature/fig%7C1.1.peg.1");
    expect(liveTabScope()).toBe("/feature/fig%7C1.1.peg.1?tab=");
  });
});
