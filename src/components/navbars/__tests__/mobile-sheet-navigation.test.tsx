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

const outbreakTitles = [
  "Measles 2025",
  "Influenza H5N1 2024",
  "Mpox 2024",
  "SARS-CoV-2",
];

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

    const docs = screen.getByRole("link", { name: /Documentation/ });
    expect(docs).toHaveAccessibleName(/Documentation \(opens in a new tab\)/);
    expect(docs).toHaveAttribute("target", "_blank");
    expect(docs).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("marks the Services outbreak links as external", async () => {
    const user = userEvent.setup();
    render(<MobileSheetNavigation {...props} />);

    await user.click(screen.getByRole("button", { name: /Services\d+/ }));
    await user.click(
      screen.getByRole("button", { name: /BV-BRC Outbreak Tracker/ }),
    );

    for (const title of outbreakTitles) {
      const link = screen.getByRole("link", {
        name: `${title} (opens in a new tab)`,
      });
      expect(link).toHaveAccessibleName(`${title} (opens in a new tab)`);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });
});
