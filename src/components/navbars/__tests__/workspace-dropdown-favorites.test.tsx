import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { recentWorkspaceFoldersStorageKey } from "@/lib/recent-workspace-folders";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { WorkspaceDropdownContent } from "../workspace-dropdown-content";

const timedOut =
  "The BV-BRC workspace service did not respond (connection timed out after 10 s).";

function favoritesAnswer(answer: () => Response) {
  const record = { calls: 0 };
  server.use(
    http.post("/api/services/workspace", () => {
      record.calls += 1;
      return answer();
    }),
  );
  return record;
}

function renderMenu() {
  render(
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <WorkspaceDropdownContent isAuthenticated wsUsername="alice@bvbrc" />
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>,
    { wrapper: createQueryClientWrapper() },
  );
}

describe("WorkspaceDropdownContent favorites", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("says the favorites could not be loaded, with Retry, instead of 'No favorites yet'", async () => {
    const record = favoritesAnswer(() =>
      HttpResponse.json({ error: timedOut, code: "upstream" }, { status: 504 }),
    );
    renderMenu();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Couldn't load favorites: ${timedOut}`);
    expect(screen.queryByText("No favorites yet")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(record.calls).toBe(2);
    });
  });

  it("says 'No favorites yet' when the favorites file does not exist", async () => {
    // A recent folder keeps the section visible when there are no favorites.
    localStorage.setItem(
      recentWorkspaceFoldersStorageKey,
      JSON.stringify([{ path: "/alice@bvbrc/home/Recent", visitedAt: 1 }]),
    );
    favoritesAnswer(() => HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [] }));
    renderMenu();

    expect(await screen.findByText("No favorites yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
