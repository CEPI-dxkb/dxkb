import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

const { mockPush, navigation } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  navigation: {
    pathname: "/genome",
    searchParams: new URLSearchParams({ keyword: "E. coli" }),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => navigation.searchParams,
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock("../mobile-navbar", () => ({ default: () => null }));
vi.mock("../theme-switcher-navbar", () => ({
  NavbarThemeSwitcher: () => null,
}));
vi.mock("../workspace-dropdown-content", () => ({
  WorkspaceDropdownContent: () => null,
}));
vi.mock("@/components/auth/su-banner", () => ({ SuBanner: () => null }));
vi.mock("@/components/jobs/job-status-pill", () => ({
  JobStatusPill: () => null,
}));

import Navbar from "../navbar";

describe("Navbar", () => {
  beforeEach(() => {
    navigation.pathname = "/genome";
    navigation.searchParams = new URLSearchParams({ keyword: "E. coli" });
  });

  it.each([
    ["/genome", "Genomes"],
    ["/feature", "Features"],
    ["/epitope", "Epitopes"],
    ["/surveillance", "Surveillance"],
    ["/taxonomy", "Taxa"],
  ])(
    "hydrates the navbar from a canonical %s search",
    (pathname, searchType) => {
      navigation.pathname = pathname;
      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <Navbar />
        </QueryClientProvider>,
      );

      expect(screen.getByRole("textbox")).toHaveValue("E. coli");
      expect(
        screen.getByRole("combobox", { name: /search type/i }),
      ).toHaveTextContent(searchType);
    },
  );

  it("does not treat a Taxonomy member keyword as a navbar search", () => {
    navigation.pathname = "/taxonomy/234";
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Navbar />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(
      screen.getByRole("combobox", { name: /search type/i }),
    ).toHaveTextContent("All Data Types");
  });
});
