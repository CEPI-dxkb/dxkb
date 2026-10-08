import {
  captureColumns,
  playColumnTransition,
  type ColumnsSnapshot,
} from "@/components/workspace/folder-picker/folder-picker-motion";

// jsdom has no layout, no Web Animations API and no matchMedia, so the strip's
// geometry, `animate` and the animation frames are all driven by hand here.

interface PlayedAnimation {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  animation: { onfinish: (() => void) | null };
}

let played: PlayedAnimation[] = [];
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
let clock = 1000;
let reducedMotion = false;
const cancelFrame = vi.fn((id: number) => {
  frames.delete(id);
});

beforeEach(() => {
  played = [];
  frames = new Map();
  nextFrame = 1;
  clock = 1000;
  reducedMotion = false;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion,
    }),
  });
  Element.prototype.animate = vi.fn(function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    const animation = { onfinish: null };
    played.push({ target: this, keyframes, options, animation });
    return animation as unknown as Animation;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Run the pending animation frames with timestamp `at` (ms). */
function runFrame(at: number) {
  clock = at;
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(at);
}

function rect(left: number, top: number, width: number, height: number) {
  return DOMRect.fromRect({ x: left, y: top, width, height });
}

/**
 * A strip like the picker's: `content` holds the columns, the overlay hosts
 * leaving columns. While the tween sets an inline width on the content, the
 * strip's scroll range follows it, as it does in a browser.
 */
function createStrip(naturalWidth: number) {
  const strip = document.createElement("div");
  const content = document.createElement("div");
  const overlay = document.createElement("div");
  strip.append(content);
  document.body.append(strip, overlay);
  let width = naturalWidth;
  Object.defineProperty(strip, "scrollWidth", {
    configurable: true,
    get: () => parseFloat(content.style.width) || width,
  });
  const scrollTo = vi.fn((options: ScrollToOptions) => {
    strip.scrollLeft = options.left ?? strip.scrollLeft;
  });
  Object.defineProperty(strip, "scrollTo", { value: scrollTo });
  overlay.getBoundingClientRect = () => rect(100, 50, 600, 400);
  return {
    strip,
    content,
    overlay,
    scrollTo,
    setNaturalWidth: (next: number) => {
      width = next;
    },
  };
}

function addColumn(
  content: HTMLElement,
  key: string,
  geometry = rect(100, 50, 180, 400),
) {
  const column = document.createElement("div");
  column.dataset.pickerKey = key;
  column.dataset.pickerColumn = String(content.children.length);
  column.textContent = key;
  column.getBoundingClientRect = () => geometry;
  content.append(column);
  return column;
}

function snapshotOf(
  strip: HTMLElement,
  overlay: HTMLElement,
  depth: number,
  place = "home",
): ColumnsSnapshot {
  return captureColumns({ strip, overlay, place, depth });
}

describe("captureColumns", () => {
  it("records the scroll state and each column relative to the overlay", () => {
    const { strip, content, overlay } = createStrip(900);
    strip.scrollLeft = 40;
    const home = addColumn(content, "home:", rect(100, 50, 240, 400));
    const alpha = addColumn(content, "home:/a/home/Alpha", rect(340, 50, 180, 400));

    expect(snapshotOf(strip, overlay, 1)).toEqual({
      place: "home",
      depth: 1,
      scrollLeft: 40,
      scrollWidth: 900,
      columns: [
        { key: "home:", node: home, left: 0, top: 0, width: 240, height: 400 },
        {
          key: "home:/a/home/Alpha",
          node: alpha,
          left: 240,
          top: 0,
          width: 180,
          height: 400,
        },
      ],
    });
  });
});

describe("playColumnTransition", () => {
  it("jumps straight to the target on the first layout", () => {
    const { strip, content, overlay, scrollTo } = createStrip(600);
    addColumn(content, "home:");

    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: null,
      scrollLeft: 0,
      place: "home",
      depth: 0,
    });

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: "instant" });
    expect(frames.size).toBe(0);
    expect(played).toEqual([]);
  });

  it("leaves the strip where it is for a move within a column", () => {
    const { strip, content, overlay, scrollTo } = createStrip(900);
    addColumn(content, "home:");
    addColumn(content, "home:/Alpha");
    // Wherever the user scrolled it to.
    strip.scrollLeft = 40;
    const snapshot = snapshotOf(strip, overlay, 1);

    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot,
      scrollLeft: 300,
      place: "home",
      depth: 1,
    });

    expect(scrollTo).not.toHaveBeenCalled();
    expect(strip.scrollLeft).toBe(40);
    expect(content.style.width).toBe("");
    expect(played).toEqual([]);
  });

  it("lets a running glide finish through a move within a column", () => {
    const { strip, content, overlay, setNaturalWidth } = createStrip(800);
    addColumn(content, "home:");
    const before = snapshotOf(strip, overlay, 0);
    addColumn(content, "home:/Alpha");
    setNaturalWidth(1000);
    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: before,
      scrollLeft: 200,
      place: "home",
      depth: 1,
    });

    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: snapshotOf(strip, overlay, 1),
      scrollLeft: 200,
      place: "home",
      depth: 1,
    });
    runFrame(clock + 180);

    expect(cancelFrame).not.toHaveBeenCalled();
    expect(strip.scrollLeft).toBe(200);
    expect(content.style.width).toBe("");
  });

  it("jumps without animating when the user prefers reduced motion", () => {
    reducedMotion = true;
    const { strip, content, overlay, scrollTo, setNaturalWidth } =
      createStrip(800);
    addColumn(content, "home:");
    const before = snapshotOf(strip, overlay, 0);
    addColumn(content, "home:/Alpha");
    setNaturalWidth(1000);

    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: before,
      scrollLeft: 200,
      place: "home",
      depth: 1,
    });

    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: "instant" });
    expect(content.style.width).toBe("");
    expect(frames.size).toBe(0);
    expect(played).toEqual([]);
  });

  it("glides the scroll position and the content width together going in", () => {
    const { strip, content, overlay, scrollTo, setNaturalWidth } =
      createStrip(800);
    addColumn(content, "home:");
    const before = snapshotOf(strip, overlay, 0);
    addColumn(content, "home:/Alpha");
    setNaturalWidth(1000);

    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: before,
      scrollLeft: 200,
      place: "home",
      depth: 1,
    });

    // Painted from where it was: the old width, the old position.
    expect(scrollTo).not.toHaveBeenCalled();
    expect(content.style.width).toBe("800px");
    expect(content.style.overflow).toBe("clip");
    expect(strip.scrollLeft).toBe(0);

    const start = clock;
    const samples: { left: number; width: number }[] = [];
    for (const elapsed of [30, 60, 90, 120, 150]) {
      runFrame(start + elapsed);
      samples.push({
        left: strip.scrollLeft,
        width: parseFloat(content.style.width),
      });
    }
    // Halfway in time, easeOutCubic is 87.5% of the way there.
    expect(samples[2]).toEqual({ left: 175, width: 975 });
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index].left).toBeGreaterThan(samples[index - 1].left);
      expect(samples[index].width).toBeGreaterThan(samples[index - 1].width);
    }

    runFrame(start + 180);
    expect(strip.scrollLeft).toBe(200);
    expect(content.style.width).toBe("");
    expect(content.style.overflow).toBe("");
    expect(frames.size).toBe(0);
  });

  it("never runs the glide backwards on an early frame", () => {
    const { strip, content, overlay, setNaturalWidth } = createStrip(800);
    addColumn(content, "home:");
    const before = snapshotOf(strip, overlay, 0);
    addColumn(content, "home:/Alpha");
    setNaturalWidth(1000);
    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: before,
      scrollLeft: 200,
      place: "home",
      depth: 1,
    });

    // A frame's timestamp can predate the glide's start.
    runFrame(clock - 16);

    expect(strip.scrollLeft).toBe(0);
    expect(content.style.width).toBe("800px");
    expect(frames.size).toBe(1);
  });

  it("glides back the same way going out", () => {
    const { strip, content, overlay, setNaturalWidth } = createStrip(1000);
    addColumn(content, "home:");
    const alpha = addColumn(content, "home:/Alpha", rect(340, 50, 180, 400));
    strip.scrollLeft = 200;
    const before = snapshotOf(strip, overlay, 1);
    alpha.remove();
    setNaturalWidth(800);

    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: before,
      scrollLeft: 0,
      place: "home",
      depth: 0,
    });

    expect(strip.scrollLeft).toBe(200);
    expect(content.style.width).toBe("1000px");
    const start = clock;
    runFrame(start + 90);
    expect(strip.scrollLeft).toBe(25);
    expect(content.style.width).toBe("825px");
    runFrame(start + 180);
    expect(strip.scrollLeft).toBe(0);
    expect(content.style.width).toBe("");
  });

  it("restarts from the natural layout when a new move interrupts a glide", () => {
    const { strip, content, overlay, setNaturalWidth } = createStrip(800);
    addColumn(content, "home:");
    const first = snapshotOf(strip, overlay, 0);
    addColumn(content, "home:/Alpha");
    setNaturalWidth(1000);
    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: first,
      scrollLeft: 200,
      place: "home",
      depth: 1,
    });
    const running = [...frames.keys()][0];
    runFrame(clock + 60);

    // Mid-glide, the user goes one folder deeper.
    const second = snapshotOf(strip, overlay, 1);
    addColumn(content, "home:/Alpha/Beta");
    setNaturalWidth(1200);
    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: second,
      scrollLeft: 400,
      place: "home",
      depth: 2,
    });

    expect(cancelFrame).toHaveBeenCalledWith(running + 1);
    expect(frames.size).toBe(1);
    // It measured the new range without the old glide's inline width, so the
    // width keeps growing toward the real end (1200) instead of holding at
    // the interrupted width (about 941) and snapping at the finish.
    const restart = clock;
    runFrame(restart + 90);
    expect(parseFloat(content.style.width)).toBeGreaterThan(1150);
    runFrame(restart + 180);
    expect(strip.scrollLeft).toBe(400);
    expect(content.style.width).toBe("");
  });

  it("fades in only the columns that appeared", () => {
    const { strip, content, overlay, setNaturalWidth } = createStrip(800);
    const home = addColumn(content, "home:");
    const before = snapshotOf(strip, overlay, 0);
    const alpha = addColumn(content, "home:/Alpha");
    setNaturalWidth(1000);

    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: before,
      scrollLeft: 200,
      place: "home",
      depth: 1,
    });

    expect(played).toHaveLength(1);
    expect(played[0]).toMatchObject({
      target: alpha,
      keyframes: [
        { opacity: 0, transform: "translateX(12px)" },
        { opacity: 1, transform: "none" },
      ],
      options: { duration: 180, easing: "cubic-bezier(0.33, 1, 0.68, 1)" },
    });
    expect(played.some((entry) => entry.target === home)).toBe(false);
  });

  it("still fades a new column in when the strip does not need to move", () => {
    const { strip, content, overlay, scrollTo } = createStrip(800);
    addColumn(content, "home:");
    const before = snapshotOf(strip, overlay, 0);
    const alpha = addColumn(content, "home:/Alpha");

    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: before,
      scrollLeft: 0,
      place: "home",
      depth: 1,
    });

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: "instant" });
    expect(frames.size).toBe(0);
    expect(played.map((entry) => entry.target)).toEqual([alpha]);
  });

  it("plays a leaving column's exit on an inert copy over the strip", () => {
    const { strip, content, overlay, setNaturalWidth } = createStrip(1000);
    addColumn(content, "home:");
    const alpha = addColumn(content, "home:/Alpha", rect(340, 60, 180, 390));
    strip.scrollLeft = 200;
    const before = snapshotOf(strip, overlay, 1);
    alpha.remove();
    setNaturalWidth(800);

    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: before,
      scrollLeft: 0,
      place: "home",
      depth: 0,
    });

    expect(overlay.children).toHaveLength(1);
    const ghost = overlay.children[0] as HTMLElement;
    expect(ghost).not.toBe(alpha);
    expect(ghost).toHaveTextContent("home:/Alpha");
    expect(ghost).not.toHaveAttribute("data-picker-key");
    expect(ghost).not.toHaveAttribute("data-picker-column");
    expect(ghost).toHaveAttribute("aria-hidden", "true");
    expect(ghost.inert).toBe(true);
    expect(ghost.style).toMatchObject({
      position: "absolute",
      left: "240px",
      top: "10px",
      width: "180px",
      height: "390px",
      margin: "0px",
    });
    // It drifts with the columns (they move 200px right) as it fades.
    const exit = played.find((entry) => entry.target === ghost);
    expect(exit).toMatchObject({
      keyframes: [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateX(212px)" },
      ],
      options: { duration: 180, fill: "forwards" },
    });

    exit?.animation.onfinish?.();
    expect(overlay.children).toHaveLength(0);
  });

  it("clears an interrupted exit's copy when the next move starts", () => {
    const { strip, content, overlay } = createStrip(800);
    addColumn(content, "home:");
    const alpha = addColumn(content, "home:/Alpha", rect(340, 50, 180, 400));
    const inside = snapshotOf(strip, overlay, 1);
    alpha.remove();
    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: inside,
      scrollLeft: 0,
      place: "home",
      depth: 0,
    });
    const ghost = overlay.children[0];

    // A move within the column lets the exit play on.
    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: snapshotOf(strip, overlay, 0),
      scrollLeft: 0,
      place: "home",
      depth: 0,
    });
    expect([...overlay.children]).toEqual([ghost]);

    // Going straight back in, the copy would fade over the returning column.
    const outside = snapshotOf(strip, overlay, 0);
    addColumn(content, "home:/Alpha", rect(340, 50, 180, 400));
    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: outside,
      scrollLeft: 0,
      place: "home",
      depth: 1,
    });

    expect(overlay.children).toHaveLength(0);
  });

  it("animates a change of place at the same depth", () => {
    const { strip, content, overlay } = createStrip(800);
    const home = addColumn(content, "home:");
    const before = snapshotOf(strip, overlay, 0, "home");
    home.remove();
    const shared = addColumn(content, "shared:");

    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot: before,
      scrollLeft: 0,
      place: "shared",
      depth: 0,
    });

    expect(played.map((entry) => entry.target)).toContain(shared);
    expect(overlay.children).toHaveLength(1);
  });
});
