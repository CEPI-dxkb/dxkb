import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "alice@bvbrc", username: "alice" },
  }),
}));

vi.mock("../theme-switcher-navbar", () => ({
  NavbarThemeSwitcher: () => null,
}));
vi.mock("../user-avatar-dropdown", () => ({ UserAvatarDropdown: () => null }));
vi.mock("@/components/auth/su-banner", () => ({ SuBanner: () => null }));
vi.mock("@/components/auth/session-unverified-banner", () => ({
  SessionUnverifiedBanner: () => null,
}));
vi.mock("@/components/jobs/job-status-pill", () => ({
  JobStatusPill: () => null,
}));

import MobileNavbar from "../mobile-navbar";

const timedOut =
  "The BV-BRC workspace service did not respond (connection timed out after 10 s).";

const savedFavorites = () =>
  HttpResponse.json({
    id: 1,
    jsonrpc: "2.0",
    result: [
      [
        [
          [["favorites.json", "json", "/alice@bvbrc/home/.preferences/"]],
          JSON.stringify({ folders: ["/alice@bvbrc/home/Saved"] }),
        ],
      ],
    ],
  });

describe("MobileNavbar favorites", () => {
  beforeEach(() => {
    // jsdom has no matchMedia; the navbar reads the mobile breakpoint.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("keeps the Favorites alert up, with a disabled 'Retrying…', until the Retry answers", async () => {
    const held = Promise.withResolvers<undefined>();
    let calls = 0;
    server.use(
      http.post("/api/services/workspace", async () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ error: timedOut, code: "upstream" }, { status: 504 });
        }
        await held.promise;
        return savedFavorites();
      }),
    );
    const user = userEvent.setup();
    render(<MobileNavbar />, { wrapper: createQueryClientWrapper() });

    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    await user.click(await screen.findByRole("button", { name: /^Workspace\d+$/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Couldn't load favorites: ${timedOut}`);
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    // The Favorites subsection and its failure stay up while the retry is in flight.
    expect(
      await within(alert).findByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(timedOut);
    expect(screen.getByText("Favorites")).toBeInTheDocument();

    held.resolve(undefined);

    expect(await screen.findByRole("link", { name: "Saved" })).toHaveAttribute(
      "href",
      "/workspace/alice@bvbrc/home/Saved",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
