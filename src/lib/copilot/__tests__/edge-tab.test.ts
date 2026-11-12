import {
  answerPreview,
  clampTabTop,
  isTabDrag,
  tabPlacementAt,
  tabMinTopPx,
  tabPlacementForKey,
  tabTitle,
  tabTopMax,
  tabTopMin,
} from "../edge-tab";

describe("clampTabTop", () => {
  it("keeps the tab between the top and bottom limits", () => {
    expect(clampTabTop(0, 2000)).toBe(tabTopMin);
    expect(clampTabTop(1, 2000)).toBe(tabTopMax);
    expect(clampTabTop(0.5, 2000)).toBe(0.5);
  });

  it("holds the tab under the navbar on a short window", () => {
    expect(clampTabTop(0.08, 600)).toBeCloseTo(tabMinTopPx / 600);
    expect(clampTabTop(0.5, 600)).toBe(0.5);
  });
});

describe("isTabDrag", () => {
  it("treats a press that moved under 5px as a click", () => {
    expect(isTabDrag({ x: 10, y: 10 }, { x: 13, y: 13 })).toBe(false);
    expect(isTabDrag({ x: 10, y: 10 }, { x: 13, y: 14 })).toBe(true);
  });
});

describe("tabPlacementAt", () => {
  const viewport = { width: 1000, height: 800 };

  it("snaps to the nearer side at the pointer's height", () => {
    expect(tabPlacementAt({ x: 499, y: 400 }, viewport)).toEqual({ side: "left", top: 0.5 });
    expect(tabPlacementAt({ x: 500, y: 200 }, viewport)).toEqual({ side: "right", top: 0.25 });
  });

  it("clamps a drop near the top or bottom", () => {
    // On an 800px window the navbar floor (112px) is above the 8% limit.
    expect(tabPlacementAt({ x: 900, y: 0 }, viewport).top).toBeCloseTo(tabMinTopPx / 800);
    expect(tabPlacementAt({ x: 900, y: 800 }, viewport).top).toBe(tabTopMax);
  });
});

describe("tabPlacementForKey", () => {
  const placement = { side: "right", top: 0.5 } as const;

  it("moves along the edge with Up and Down", () => {
    expect(tabPlacementForKey(placement, "ArrowUp", 800)?.top).toBeCloseTo(0.45);
    expect(tabPlacementForKey(placement, "ArrowDown", 800)?.top).toBeCloseTo(0.55);
    expect(tabPlacementForKey({ side: "left", top: 0.92 }, "ArrowDown", 800)).toEqual({
      side: "left",
      top: tabTopMax,
    });
  });

  it("moves from where the tab is drawn when it is held under the navbar", () => {
    // Saved at 0.08, drawn at 112 / 600 = 0.1867: the next ArrowDown moves it a full step.
    const held = { side: "right", top: 0.08 } as const;
    expect(tabPlacementForKey(held, "ArrowDown", 600)?.top).toBeCloseTo(112 / 600 + 0.05);
    expect(tabPlacementForKey(held, "ArrowUp", 600)?.top).toBeCloseTo(112 / 600);
  });

  it("switches edges with Left and Right, keeping the height", () => {
    expect(tabPlacementForKey(placement, "ArrowLeft", 800)).toEqual({ side: "left", top: 0.5 });
    expect(tabPlacementForKey(placement, "ArrowRight", 800)).toEqual(placement);
  });

  it("ignores other keys", () => {
    expect(tabPlacementForKey(placement, "Enter", 800)).toBeNull();
  });
});

describe("answerPreview", () => {
  it("flattens markdown into one short line", () => {
    expect(
      answerPreview("# Result\n\nI found **12** jobs:\n- one\n- two\n```\ncode\n```\nDone."),
    ).toBe("Result I found 12 jobs: • one • two Done.");
    expect(answerPreview("x".repeat(300))).toHaveLength(140);
  });
});

describe("tabTitle", () => {
  it("names what the minimized chat is doing, else previews its newest answer", () => {
    expect(tabTitle({ working: true, unread: true, preview: "Hi" })).toBe(
      "AskClark is writing an answer. Drag to move.",
    );
    expect(tabTitle({ working: false, unread: true, preview: "Hi" })).toBe(
      "AskClark: answer ready. Drag to move.",
    );
    expect(tabTitle({ working: false, unread: false, preview: "Hi" })).toBe(
      "Hi. Drag to move.",
    );
    expect(tabTitle({ working: false, unread: false, preview: "Done…" })).toBe(
      "Done. Drag to move.",
    );
    expect(tabTitle({ working: false, unread: false, preview: "" })).toBe(
      "Restore AskClark. Drag to move.",
    );
  });
});
