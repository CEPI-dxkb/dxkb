import type { ReactNode } from "react";
import { renderHook, screen } from "@testing-library/react";

import { stubMenuLayout } from "@/test-helpers/menu-layout";
import {
  CollectionToolbarLayoutProvider,
  collectionToolbarLayoutClasses,
  useCollectionToolbarLayout,
} from "../toolbar-layout";
import { renderToolbar } from "./fixtures/toolbar-harness";

stubMenuLayout();

function BesideViewSwitch({ children }: { children: ReactNode }) {
  return (
    <CollectionToolbarLayoutProvider value="besideViewSwitch">
      {children}
    </CollectionToolbarLayoutProvider>
  );
}

function toolbarFrame() {
  const frame = screen.getByRole("toolbar", { name: "Filters" }).parentElement;
  if (!frame) throw new Error("The toolbar has no frame.");
  return frame;
}

function toolbarRow() {
  return screen.getByRole("toolbar", { name: "Filters" });
}

function keywordBox() {
  const box = screen.getByRole("searchbox", {
    name: "Search keywords",
  }).parentElement;
  if (!box) throw new Error("The keyword input has no box.");
  return box;
}

describe("useCollectionToolbarLayout", () => {
  it("is the default layout without a provider", () => {
    const { result } = renderHook(() => useCollectionToolbarLayout());

    expect(result.current).toBe(collectionToolbarLayoutClasses.default);
  });

  it("is the layout of the nearest provider", () => {
    const { result } = renderHook(() => useCollectionToolbarLayout(), {
      wrapper: BesideViewSwitch,
    });

    expect(result.current).toBe(collectionToolbarLayoutClasses.besideViewSwitch);
  });
});

describe("CollectionToolbar layout", () => {
  describe("default", () => {
    it("keeps the frame every collection page's toolbar has always had", () => {
      renderToolbar();

      expect(toolbarFrame().className).toBe("@container mb-1 shrink-0");
    });

    it("keeps the keyword box's resting and focused widths", () => {
      renderToolbar();

      expect(keywordBox()).toHaveClass(
        "@2xl:w-44",
        "@2xl:focus-within:w-64",
      );
      expect(keywordBox()).not.toHaveClass("@2xl:w-56");
    });

    it("widens a typed keyword to w-56 over the resting width", () => {
      renderToolbar({ overrides: { keyword: "groEL" } });

      expect(keywordBox()).toHaveClass("@2xl:w-56", "@2xl:focus-within:w-64");
      expect(keywordBox()).not.toHaveClass("@2xl:w-44");
    });

    it("reserves no space for a view switch", () => {
      renderToolbar();

      expect(toolbarFrame()).not.toHaveClass("ps-(--view-switch-inset)");
      expect(toolbarRow()).not.toHaveClass("ms-(--view-switch-inset)");
    });
  });

  describe("beside a view switch", () => {
    it("reserves the switch's inset on the row, not on the container", () => {
      renderToolbar({ wrapper: BesideViewSwitch });

      // Padding on the `@container` would shrink the box the `@2xl` one-row breakpoint measures
      // and wrap the toolbar early; the margin on the row inside it leaves the container whole.
      expect(toolbarRow()).toHaveClass("ms-(--view-switch-inset)");
      expect(toolbarFrame()).toHaveClass("@container", "shrink-0");
      expect(toolbarFrame()).not.toHaveClass("ps-(--view-switch-inset)");
    });

    it("leaves the header's spacing to the body below it", () => {
      renderToolbar({ wrapper: BesideViewSwitch });

      expect(toolbarFrame()).toHaveClass("mb-2");
      expect(toolbarFrame()).not.toHaveClass("mb-1");
    });

    it("rests the keyword box at w-56 for its longer placeholder", () => {
      renderToolbar({ wrapper: BesideViewSwitch });

      expect(keywordBox()).toHaveClass("@2xl:w-56", "@2xl:focus-within:w-64");
      expect(keywordBox()).not.toHaveClass("@2xl:w-44");
    });

    it("keeps a typed keyword at w-56, focused at w-64", () => {
      renderToolbar({
        wrapper: BesideViewSwitch,
        overrides: { keyword: "groEL" },
      });

      expect(keywordBox()).toHaveClass("@2xl:w-56", "@2xl:focus-within:w-64");
    });

    it("still draws the same toolbar and keyword input", () => {
      renderToolbar({ wrapper: BesideViewSwitch });

      expect(screen.getByRole("toolbar", { name: "Filters" })).toBeInTheDocument();
      expect(
        screen.getByRole("searchbox", { name: "Search keywords" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Filters/ })).toBeInTheDocument();
    });
  });
});
