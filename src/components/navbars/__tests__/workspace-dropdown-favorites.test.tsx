import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("keeps the alert up, with a disabled 'Retrying…', until the Retry answers", async () => {
    // A recent folder keeps the section visible once the retry finds no favorites.
    localStorage.setItem(
      recentWorkspaceFoldersStorageKey,
      JSON.stringify([{ path: "/alice@bvbrc/home/Recent", visitedAt: 1 }]),
    );
    const held = Promise.withResolvers<undefined>();
    let calls = 0;
    server.use(
      http.post("/api/services/workspace", async () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ error: timedOut, code: "upstream" }, { status: 504 });
        }
        await held.promise;
        return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [] });
      }),
    );
    renderMenu();

    const alert = await screen.findByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(
      await within(alert).findByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(timedOut);
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull();

    held.resolve(undefined);

    expect(await screen.findByText("No favorites yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(calls).toBe(2);
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
