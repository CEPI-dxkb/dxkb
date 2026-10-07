import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { FolderPickerBreadcrumb } from "@/components/workspace/folder-picker/folder-picker-breadcrumb";

const home = "/alice@bvbrc/home";

type Props = ComponentProps<typeof FolderPickerBreadcrumb>;

function renderBreadcrumb(overrides: Partial<Props> = {}) {
  const props: Props = {
    place: "home",
    chain: [],
    homePath: home,
    disabled: false,
    onJump: vi.fn(),
    ...overrides,
  };
  const view = render(<FolderPickerBreadcrumb {...props} />);
  return {
    ...props,
    rerender: (next: Partial<Props>) => {
      view.rerender(<FolderPickerBreadcrumb {...props} {...next} />);
    },
  };
}

function crumbs() {
  return within(
    screen.getByRole("navigation", { name: "Selected folder" }),
  ).getAllByRole("button");
}

describe("FolderPickerBreadcrumb", () => {
  it("shows only the place, as the current location, with nothing selected", () => {
    renderBreadcrumb({ place: "shared" });

    expect(crumbs().map((crumb) => crumb.textContent)).toEqual([
      "Shared Workspaces",
    ]);
    expect(crumbs()[0]).toHaveAttribute("aria-current", "location");
  });

  it("shows every folder of the path, with the full path on hover", () => {
    const chain = [`${home}/a`, `${home}/a/b`, `${home}/a/b/c`, `${home}/a/b/c/d`];
    renderBreadcrumb({ chain });

    expect(crumbs().map((crumb) => crumb.textContent)).toEqual([
      "Home",
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(crumbs().slice(1).map((crumb) => crumb.title)).toEqual(chain);
    expect(
      crumbs().map((crumb) => crumb.getAttribute("aria-current")),
    ).toEqual([null, null, null, null, "location"]);
  });

  it("names the home folder Home when it is part of the path", () => {
    renderBreadcrumb({
      place: "myWorkspaces",
      chain: [home, `${home}/Experiments`],
    });

    expect(crumbs().map((crumb) => crumb.textContent)).toEqual([
      "My Workspaces",
      "Home",
      "Experiments",
    ]);
  });

  it("jumps to the depth of the clicked crumb", async () => {
    const user = userEvent.setup();
    const { onJump } = renderBreadcrumb({
      chain: [`${home}/a`, `${home}/a/b`],
    });

    await user.click(screen.getByRole("button", { name: "a" }));
    expect(onJump).toHaveBeenLastCalledWith(1);
    await user.click(screen.getByRole("button", { name: "b" }));
    expect(onJump).toHaveBeenLastCalledWith(2);
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(onJump).toHaveBeenLastCalledWith(0);
  });

  it("disables every crumb while the picker is busy", async () => {
    const user = userEvent.setup();
    const { onJump } = renderBreadcrumb({
      chain: [`${home}/a`],
      disabled: true,
    });

    for (const crumb of crumbs()) expect(crumb).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(onJump).not.toHaveBeenCalled();
  });

  it("keeps the crumbs that stay, so only new ones play their entrance", () => {
    const { rerender } = renderBreadcrumb({ chain: [`${home}/a`] });
    const [root, first] = screen.getAllByRole("listitem");

    rerender({ chain: [`${home}/a`, `${home}/a/b`] });

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toBe(root);
    expect(items[1]).toBe(first);
    expect(items[2].className).toContain("animate-in");
  });

  it("replaces the last crumb when the selection moves to a sibling", () => {
    const { rerender } = renderBreadcrumb({ chain: [`${home}/a`] });
    const [root, first] = screen.getAllByRole("listitem");

    rerender({ chain: [`${home}/b`] });

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toBe(root);
    expect(items[1]).not.toBe(first);
    expect(items[1]).toHaveTextContent("b");
  });

  it("enters each crumb with a fade that respects reduced motion", () => {
    renderBreadcrumb({ chain: [`${home}/a`] });

    for (const item of screen.getAllByRole("listitem")) {
      expect(item).toHaveClass(
        "animate-in",
        "fade-in-0",
        "slide-in-from-right-2",
        "motion-reduce:animate-none",
      );
      // `duration-*` also sets `transition-duration` in Tailwind v4, which
      // made the crumbs animate their layout whenever they changed role.
      expect(item.className).not.toMatch(/\bduration-/);
    }
  });

  it("replaces the place crumb when the place changes", () => {
    const { rerender } = renderBreadcrumb({ place: "home" });
    const [homeCrumb] = screen.getAllByRole("listitem");

    rerender({ place: "recent" });

    const [recentCrumb] = screen.getAllByRole("listitem");
    expect(recentCrumb).not.toBe(homeCrumb);
    expect(recentCrumb).toHaveTextContent("Recently Used");
  });
});
