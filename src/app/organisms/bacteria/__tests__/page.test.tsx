import { render, screen } from "@testing-library/react";

import BacteriaPage from "../page";

const { fetchTaxonomy, redirectMock } = vi.hoisted(() => ({
  fetchTaxonomy: vi.fn(),
  redirectMock: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));

// The static fallback itself is covered with MSW in
// src/app/organisms/__tests__/landing-outage.test.tsx.
vi.mock("@/lib/services/organisms/taxonomy", () => ({
  fetchLandingRootTaxonomy: (taxonId: number) => fetchTaxonomy(taxonId) as unknown,
}));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/organisms/bacteria",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/organisms/taxon-views", () => ({
  buildTaxonViews: ({ OverviewComponent }: { OverviewComponent: React.ComponentType }) => [
    { key: "overview", label: "Overview", icon: null, Component: OverviewComponent },
    { key: "genomes", label: "Genomes", icon: null, Component: () => <div>Real genomes</div>, layout: "fill" },
    { key: "phylogeny", label: "Phylogeny", icon: null, Component: () => null, enabled: false },
  ],
}));

beforeEach(() => {
  fetchTaxonomy.mockResolvedValue({ taxonId: 2, taxonName: "Bacteria" });
});

describe("BacteriaPage", () => {
  it("fetches the bacterial root and renders a real selected view", async () => {
    render(await BacteriaPage({ searchParams: Promise.resolve({ tab: "genomes" }) }));
    expect(fetchTaxonomy).toHaveBeenCalledWith(2);
    expect(screen.getByText("Real genomes")).toBeInTheDocument();
  });

  it("redirects hidden tabs to the canonical Overview URL", async () => {
    await expect(
      BacteriaPage({ searchParams: Promise.resolve({ tab: "phylogeny" }) }),
    ).rejects.toThrow("REDIRECT:/organisms/bacteria");
  });
});
