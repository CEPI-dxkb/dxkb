import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MobileSheetNavigation } from "../mobile-sheet-navigation";
import { organismItems } from "../navbar-links";

const props = {
  favoritePaths: ["/alice@bvbrc/home/Favorite Folder"],
  isAuthenticated: true,
  recentFolders: [
    {
      path: "/alice@bvbrc/home/Recent Folder",
      visitedAt: 1,
    },
  ],
  wsUsername: "alice@bvbrc",
};

describe("MobileSheetNavigation", () => {
  it("preserves the navigation landmark and section controls", () => {
    render(<MobileSheetNavigation {...props} />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Organisms9" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /Services\d+/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Workspace10" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Resources4" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("lists the CEPI taxa, All Viruses, All Bacteria and Browse all in the Organisms section", async () => {
    const user = userEvent.setup();
    render(<MobileSheetNavigation {...props} />);

    await user.click(screen.getByRole("button", { name: "Organisms9" }));

    // Every other section is collapsed, so the navigation's visible links are the Organisms items.
    const links = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      organismItems.map((item) => item.href),
    );
    expect(links.map((link) => link.textContent)).toEqual(
      organismItems.map((item) => item.title),
    );
  });

  it("retains external-link behavior for sheet destinations", async () => {
    const user = userEvent.setup();
    render(<MobileSheetNavigation {...props} />);

    await user.click(screen.getByRole("button", { name: "Resources4" }));

    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });
});
