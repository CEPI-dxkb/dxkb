import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";

import {
  sectionAnchorId,
  sectionFlashMs,
  useSectionNav,
} from "../use-section-nav";

const ids = ["a", "b", "c"];

function Harness({ pinned = false }: { pinned?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const nav = useSectionNav({
    ref,
    topInset: pinned ? headerRef : undefined,
    ids,
  });
  return (
    <div ref={ref} data-testid="column">
      <div ref={headerRef} data-testid="header" />
      <output>{nav.active}</output>
      {ids.map((id) => (
        <div key={id} id={sectionAnchorId(id)} />
      ))}
      <button
        type="button"
        onClick={() => {
          nav.select("a");
        }}
      >
        Jump to a
      </button>
    </div>
  );
}

function layOut({
  tops,
  scrollTop = 0,
  clientHeight = 400,
  scrollHeight = 2000,
}: {
  tops: Record<string, number>;
  scrollTop?: number;
  clientHeight?: number;
  scrollHeight?: number;
}) {
  const column = screen.getByTestId("column");
  column.scrollTop = scrollTop;
  Object.defineProperty(column, "clientHeight", {
    value: clientHeight,
    configurable: true,
  });
  Object.defineProperty(column, "scrollHeight", {
    value: scrollHeight,
    configurable: true,
  });
  for (const [id, top] of Object.entries(tops)) {
    const section = document.getElementById(sectionAnchorId(id));
    if (!section) throw new Error(`No section ${id}`);
    section.getBoundingClientRect = () => ({ top }) as DOMRect;
  }
  return column;
}

describe("useSectionNav", () => {
  // Restored exactly as found: jsdom may not define element scrolling at all.
  const ownScrollTo = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollTo",
  );
  const scrollTo = vi.fn();
  let reducedMotion = false;

  beforeEach(() => {
    scrollTo.mockClear();
    Element.prototype.scrollTo = scrollTo;
    reducedMotion = false;
    // jsdom has no matchMedia.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion,
      }),
    });
  });

  afterEach(() => {
    if (ownScrollTo)
      Object.defineProperty(Element.prototype, "scrollTo", ownScrollTo);
    else Reflect.deleteProperty(Element.prototype, "scrollTo");
    Reflect.deleteProperty(window, "matchMedia");
    vi.useRealTimers();
  });

  it("highlights the last section scrolled past the top", async () => {
    render(<Harness />);
    const column = layOut({ tops: { a: -300, b: 20, c: 500 }, scrollTop: 300 });

    fireEvent.scroll(column);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("b");
    });
  });

  it("highlights the last section once scrolled to the bottom", async () => {
    render(<Harness />);
    const column = layOut({
      tops: { a: -900, b: -100, c: 300 },
      scrollTop: 1600,
    });

    fireEvent.scroll(column);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("c");
    });
  });

  it("stops a jumped-to section below a pinned header", () => {
    render(<Harness pinned />);
    layOut({ tops: { a: 400, b: 0, c: 600 }, scrollTop: 300 });
    Object.defineProperty(screen.getByTestId("header"), "offsetHeight", {
      value: 100,
    });

    fireEvent.click(screen.getByRole("button", { name: "Jump to a" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 584, behavior: "smooth" });
  });

  it("jumps without the smooth scroll for a user who asks for reduced motion", () => {
    reducedMotion = true;
    render(<Harness />);
    layOut({ tops: { a: 400, b: 0, c: 600 }, scrollTop: 300 });

    fireEvent.click(screen.getByRole("button", { name: "Jump to a" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 684, behavior: "auto" });
    expect(screen.getByRole("status")).toHaveTextContent("a");
  });

  it("holds a jumped-to section until the user scrolls by hand", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    render(<Harness />);
    const column = layOut({ tops: { a: 400, b: 0, c: 600 }, scrollTop: 300 });

    fireEvent.click(screen.getByRole("button", { name: "Jump to a" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 684, behavior: "smooth" });
    expect(screen.getByRole("status")).toHaveTextContent("a");
    const target = document.getElementById(sectionAnchorId("a"));
    expect(target).toHaveAttribute("data-flash");
    act(() => {
      vi.advanceTimersByTime(sectionFlashMs);
    });
    expect(target).not.toHaveAttribute("data-flash");
    vi.useRealTimers();

    // The smooth scroll's own events leave the jump highlighted…
    fireEvent.scroll(column);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(screen.getByRole("status")).toHaveTextContent("a");

    // …a hand scroll hands it back to the scroll position.
    fireEvent.wheel(column);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("b");
    });
  });

  it("hands a jump back on a scroll away from it, as a scrollbar drag makes", async () => {
    render(<Harness />);
    const column = layOut({ tops: { a: 400, b: 0, c: 600 }, scrollTop: 300 });

    fireEvent.click(screen.getByRole("button", { name: "Jump to a" }));

    // The smooth scroll closing in on its target keeps the jump highlighted…
    for (const scrollTop of [500, 684]) {
      column.scrollTop = scrollTop;
      fireEvent.scroll(column);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(screen.getByRole("status")).toHaveTextContent("a");
    }

    // …and a scroll back from it, with no wheel, touch or key, releases it.
    column.scrollTop = 600;
    fireEvent.scroll(column);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("b");
    });
  });
});
