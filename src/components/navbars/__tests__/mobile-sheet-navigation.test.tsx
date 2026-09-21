import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MobileSheetNavigation } from "../mobile-sheet-navigation";

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
    expect(screen.getByRole("button", { name: "Organisms3" })).toHaveAttribute(
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
