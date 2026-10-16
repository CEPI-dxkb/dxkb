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

/** Back or forward: the address changes, with no push, then popstate fires. */
function traverse(address: string) {
  window.history.replaceState(null, "", address);
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

  it("keeps the offset it is restoring when the reader leaves before the content grows", () => {
    scrollAndLeave("/taxonomy/11", 900);

    traverse("/taxonomy/11");
    const { region } = scrollRegion(300);
    const detach = attach(region);
    expect(region.scrollTop).toBe(300);
    visit("/elsewhere");
    detach();

    traverse("/taxonomy/11");
    const restored = scrollRegion();
    attach(restored.region);

    expect(restored.region.scrollTop).toBe(900);
  });

  it("keeps the offset when a restore runs out of time short of it", () => {
    scrollAndLeave("/taxonomy/12", 900);
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);

    traverse("/taxonomy/12");
    const { region, content } = scrollRegion(300);
    const detach = attach(region);
    now.mockReturnValue(3001);
    content.maxScroll = 400;
    runFrames();
    // A browser dispatches the last step's scroll event a frame later.
    region.dispatchEvent(new Event("scroll"));
    visit("/elsewhere");
    detach();

    traverse("/taxonomy/12");
    const restored = scrollRegion();
    attach(restored.region);

    expect(restored.region.scrollTop).toBe(900);
  });

  it("saves the reader's scrolling once they take over a restore", () => {
    scrollAndLeave("/taxonomy/13", 900);

    traverse("/taxonomy/13");
    const { region } = scrollRegion(300);
    const detach = attach(region);
    region.dispatchEvent(new Event("wheel"));
    region.scrollTop = 100;
    visit("/elsewhere");
    detach();

    traverse("/taxonomy/13");
    const restored = scrollRegion();
    attach(restored.region);

    expect(restored.region.scrollTop).toBe(100);
  });

  it("saves the reader's scrolling after a restore runs out of time", () => {
    scrollAndLeave("/taxonomy/14", 900);
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);

    traverse("/taxonomy/14");
    const { region } = scrollRegion(300);
    const detach = attach(region);
    now.mockReturnValue(3001);
    runFrames();
    region.dispatchEvent(new Event("pointerdown"));
    region.scrollTop = 100;
    visit("/elsewhere");
    detach();

    traverse("/taxonomy/14");
    const restored = scrollRegion();
    attach(restored.region);

    expect(restored.region.scrollTop).toBe(100);
  });

  it("leaves the offset it restored to saved", () => {
    scrollAndLeave("/taxonomy/15", 900);

    traverse("/taxonomy/15");
    const { region, content } = scrollRegion(300);
    const detach = attach(region);
    content.maxScroll = 2000;
    runFrames();
    expect(region.scrollTop).toBe(900);
    // The last step's scroll event arrives a frame later, after the restore.
    region.dispatchEvent(new Event("scroll"));
    visit("/elsewhere");
    detach();

    traverse("/taxonomy/15");
    const restored = scrollRegion();
    attach(restored.region);

    expect(restored.region.scrollTop).toBe(900);
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

  it("keeps recording a region that outlives a back or forward step", () => {
    visit("/genome/16?features.page=2");
    const { region } = scrollRegion();
    const detach = attach(region);
    region.scrollTop = 300;
    // A nested table's next page and back again, all in one region.
    visit("/genome/16?features.page=3");
    region.scrollTop = 500;
    traverse("/genome/16?features.page=2");
    region.scrollTop = 700;
    visit("/elsewhere");
    detach();

    traverse("/genome/16?features.page=2");
    const restored = scrollRegion();
    attach(restored.region);

    expect(restored.region.scrollTop).toBe(700);
  });

  it("drops what a region back is replacing recorded where nothing was saved", () => {
    visit("/taxonomy/17?tab=overview");
    visit("/taxonomy/17");
    const leaving = scrollRegion();
    const detachLeaving = attach(leaving.region);
    traverse("/taxonomy/17?tab=overview");
    leaving.region.scrollTop = 50;
    detachLeaving();
    const arriving = scrollRegion();
    const detach = attach(arriving.region);
    expect(arriving.region.scrollTop).toBe(0);
    visit("/elsewhere");
    detach();

    traverse("/taxonomy/17?tab=overview");
    const { region } = scrollRegion();
    attach(region);

    expect(region.scrollTop).toBe(0);
  });

  it("starts at the top when a link returns to the address back landed on", () => {
    scrollAndLeave("/taxonomy/18", 900);

    traverse("/taxonomy/18");
    const restored = scrollRegion();
    const detach = attach(restored.region);
    expect(restored.region.scrollTop).toBe(900);
    // A tab link to a table view, which has no scroll region, and one back.
    visit("/taxonomy/18?tab=genomes");
    detach();
    visit("/taxonomy/18");
    const { region } = scrollRegion();
    attach(region);

    expect(region.scrollTop).toBe(0);
  });

  it("restores after the router replaces the entry back landed on", () => {
    scrollAndLeave("/taxonomy/19", 900);

    traverse("/taxonomy/19");
    // Next's router writes its state onto the entry on every commit.
    window.history.replaceState({ __NA: true }, "", "/taxonomy/19");
    const { region } = scrollRegion();
    attach(region);

    expect(region.scrollTop).toBe(900);
  });

  it("restores a region the router renders before this module hears of the step", async () => {
    vi.resetModules();
    const fresh = await import("@/lib/history-scroll-restoration");
    // Next's router listens from hydration, before any region attaches, so in
    // Chromium its popstate listener runs first, and React renders a cached
    // destination in the microtask after it, attaching the ref twice in
    // Strict Mode.
    const destination = scrollRegion();
    const renderDestination = () => {
      fresh.restoreHistoryScroll(destination.region)?.();
      fresh.restoreHistoryScroll(destination.region);
    };
    window.addEventListener("popstate", renderDestination);
    try {
      visit("/taxonomy/20");
      const { region } = scrollRegion();
      const detach = fresh.restoreHistoryScroll(region);
      region.scrollTop = 900;
      visit("/elsewhere");
      detach?.();
      traverse("/taxonomy/20");
    } finally {
      window.removeEventListener("popstate", renderDestination);
    }

    expect(destination.region.scrollTop).toBe(900);
  });

  it("ignores a detached ref", () => {
    expect(restoreHistoryScroll(null)).toBeUndefined();
  });
});
