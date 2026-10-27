import { render, screen } from "@testing-library/react";

import AllOrganismsPage from "../page";

const { fetchTaxonomy, buildViews } = vi.hoisted(() => ({
  fetchTaxonomy: vi.fn(),
  buildViews: vi.fn(),
}));

// The static fallback itself is covered with MSW in
// src/app/organisms/__tests__/landing-outage.test.tsx.
vi.mock("@/lib/services/organisms/taxonomy", () => ({
  fetchLandingRootTaxonomy: (taxonId: number) => fetchTaxonomy(taxonId) as unknown,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/organisms/all",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/organisms/taxon-views", () => ({
  buildTaxonViews: (options: unknown) => buildViews(options) as unknown,
}));

beforeEach(() => {
  fetchTaxonomy.mockImplementation((taxonId: number) =>
    Promise.resolve({ taxonId, taxonName: String(taxonId) }),
  );
  buildViews.mockReturnValue([
    { key: "overview", label: "Overview", icon: null, Component: () => null },
    { key: "genomes", label: "Genomes", icon: null, Component: () => <div>Composite genomes</div>, layout: "fill" },
  ]);
});

describe("AllOrganismsPage", () => {
  it("builds a two-root composite scope", async () => {
    render(await AllOrganismsPage({ searchParams: Promise.resolve({ tab: "genomes" }) }));

    expect(fetchTaxonomy).toHaveBeenCalledWith(131567);
    expect(fetchTaxonomy).toHaveBeenCalledWith(10239);
    const options = buildViews.mock.calls[0]?.[0] as {
      scope: { kind: string; roots: { taxonId: number }[] };
    };
    expect(options.scope.kind).toBe("composite");
    expect(options.scope.roots.map((root) => root.taxonId)).toEqual([131567, 10239]);
    expect(screen.getByText("Composite genomes")).toBeInTheDocument();
  });

  it("still fails on an error the root lookup does not absorb", async () => {
    fetchTaxonomy.mockImplementation((taxonId: number) =>
      taxonId === 10239
        ? Promise.reject(new Error("virus root unavailable"))
        : Promise.resolve({ taxonId, taxonName: String(taxonId) }),
    );

    await expect(AllOrganismsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "virus root unavailable",
    );
  });
});
