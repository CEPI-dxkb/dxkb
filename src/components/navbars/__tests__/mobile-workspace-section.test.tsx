import { render, screen, within } from "@testing-library/react";

import { MobileWorkspaceSection } from "../mobile-workspace-section";

const authenticatedProps = {
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

describe("MobileWorkspaceSection", () => {
  it("renders authenticated workspace destinations and loaded folders", () => {
    render(<MobileWorkspaceSection {...authenticatedProps} />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/workspace/alice@bvbrc/home",
    );
    expect(screen.getByRole("link", { name: "My Jobs" })).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(
      screen.getByRole("link", { name: "Favorite Folder" }),
    ).toHaveAttribute("href", "/workspace/alice@bvbrc/home/Favorite%20Folder");
    expect(screen.getByText("Recently Visited")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recent Folder" })).toHaveAttribute(
      "href",
      "/workspace/alice@bvbrc/home/Recent%20Folder",
    );
    expect(
      screen.queryByText("Sign in to access your full workspace."),
    ).not.toBeInTheDocument();
  });

  it("routes protected destinations to sign-in and hides private folders", () => {
    render(
      <MobileWorkspaceSection
        favoritePaths={authenticatedProps.favoritePaths}
        isAuthenticated={false}
        recentFolders={authenticatedProps.recentFolders}
        wsUsername=""
      />,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/sign-in?redirect=/workspace",
    );
    expect(screen.getByRole("link", { name: "My Jobs" })).toHaveAttribute(
      "href",
      "/sign-in?redirect=/jobs",
    );
    expect(
      screen.getByRole("link", { name: "Public Workspaces" }),
    ).toHaveAttribute("href", "/workspace/public");
    expect(
      screen.queryByRole("link", { name: "Favorite Folder" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Recently Visited")).not.toBeInTheDocument();

    const prompt = screen
      .getByText("Sign in to access your full workspace.")
      .closest("div");
    expect(prompt).not.toBeNull();
    expect(
      within(prompt as HTMLElement).getByRole("link", { name: "Sign In" }),
    ).toHaveAttribute("href", "/sign-in?redirect=/workspace");
  });
});
