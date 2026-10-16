import { restoreHistoryScroll } from "@/lib/history-scroll-restoration";

/**
 * jsdom has no layout, so a region here is a div whose scrollTop clamps to a
 * height the test sets, and fires `scroll` when it moves, as a browser's does.
 */
function scrollRegion(maxScroll = 5000) {
  const region = document.createElement("div");
  const content = { maxScroll };
  let top = 0;
  Object.defineProperty(region, "scrollTop", {
    get: () => top,
    set: (value: number) => {
      const next = Math.max(0, Math.min(value, content.maxScroll));
      if (next === top) return;
      top = next;
      region.dispatchEvent(new Event("scroll"));
    },
  });
  return { region, content };
}

function attach(region: HTMLElement) {
  const detach = restoreHistoryScroll(region);
  if (!detach) throw new Error("expected a cleanup");
  return detach;
}

/** A link: a new history entry, no popstate. */
function visit(address: string) {
  window.history.pushState(null, "", address);
}

/** Back or forward: the address changes, then popstate fires. */
function traverse(address: string) {
  window.history.pushState(null, "", address);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Leave a region scrolled to `offset` at `address`. */
function scrollAndLeave(address: string, offset: number) {
  visit(address);
  const { region } = scrollRegion();
  const detach = attach(region);
  region.scrollTop = offset;
  visit("/elsewhere");
  detach();
}

describe("restoreHistoryScroll", () => {
  let frames: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    frames = new Map();
    let nextFrame = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      frames.delete(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function runFrames() {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback(performance.now());
    }
  }

  it("returns a region to where it was when back lands on its address", () => {
    scrollAndLeave("/taxonomy/1", 900);

    traverse("/taxonomy/1");
    const { region } = scrollRegion();
    attach(region);

    expect(region.scrollTop).toBe(900);
  });

  it("starts at the top when a link, not back or forward, opens the address", () => {
    scrollAndLeave("/taxonomy/2", 700);

    visit("/taxonomy/2");
    const { region } = scrollRegion();
    attach(region);

    expect(region.scrollTop).toBe(0);
  });

  it("keys offsets by path and query", () => {
    scrollAndLeave("/taxonomy/3", 300);
    scrollAndLeave("/taxonomy/3?tab=strains", 1200);

    traverse("/taxonomy/3");
    const { region } = scrollRegion();
    attach(region);

    expect(region.scrollTop).toBe(300);
  });

  it("keeps scrolling each frame while the content grows tall enough", () => {
    scrollAndLeave("/taxonomy/4", 900);

    traverse("/taxonomy/4");
    const { region, content } = scrollRegion(300);
    attach(region);
    expect(region.scrollTop).toBe(300);

    content.maxScroll = 600;
    runFrames();
    expect(region.scrollTop).toBe(600);

    content.maxScroll = 2000;
    runFrames();
    expect(region.scrollTop).toBe(900);
    expect(frames.size).toBe(0);
  });

  it("stops restoring once the reader scrolls", () => {
    scrollAndLeave("/taxonomy/5", 900);

    traverse("/taxonomy/5");
    const { region, content } = scrollRegion(300);
    attach(region);
    region.dispatchEvent(new Event("wheel"));
    content.maxScroll = 2000;
    runFrames();

    expect(region.scrollTop).toBe(300);
  });

  it("gives up after two seconds", () => {
    scrollAndLeave("/taxonomy/6", 900);
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);

    traverse("/taxonomy/6");
    const { region, content } = scrollRegion(300);
    attach(region);
    now.mockReturnValue(3001);
    runFrames();
    content.maxScroll = 2000;
    runFrames();

    expect(region.scrollTop).toBe(300);
  });

  it("stops restoring when the region unmounts", () => {
    scrollAndLeave("/taxonomy/7", 900);

    traverse("/taxonomy/7");
    const { region } = scrollRegion(300);
    const detach = attach(region);
    detach();

    expect(frames.size).toBe(0);
  });

  it("restores on the second attach that Strict Mode makes", () => {
    scrollAndLeave("/taxonomy/8", 900);

    traverse("/taxonomy/8");
    const first = scrollRegion(0);
    attach(first.region)();
    const second = scrollRegion();
    attach(second.region);

    expect(second.region.scrollTop).toBe(900);
  });

  it("does not give the next address the offset of a region back is replacing", () => {
    scrollAndLeave("/taxonomy/9?tab=overview", 800);

    visit("/taxonomy/9");
    const leaving = scrollRegion();
    const detach = attach(leaving.region);
    traverse("/taxonomy/9?tab=overview");
    // The page being left still scrolls before the next one replaces it.
    leaving.region.scrollTop = 50;
    detach();
    const { region } = scrollRegion();
    attach(region);

    expect(region.scrollTop).toBe(800);
  });

  it("follows a History API write while the region stays mounted", () => {
    visit("/genome/10");
    const { region } = scrollRegion();
    const detach = attach(region);
    window.history.replaceState(null, "", "/genome/10?features.page=2");
    region.scrollTop = 600;
    visit("/elsewhere");
    detach();

    traverse("/genome/10?features.page=2");
    const restored = scrollRegion();
    attach(restored.region);

    expect(restored.region.scrollTop).toBe(600);
  });

  it("ignores a detached ref", () => {
    expect(restoreHistoryScroll(null)).toBeUndefined();
  });
});
