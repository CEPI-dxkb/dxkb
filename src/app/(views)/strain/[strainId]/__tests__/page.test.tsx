import { render, screen } from "@testing-library/react";
import { DataApiError } from "@/lib/data-api/repository";

const mocks = vi.hoisted(() => ({
  getStrain: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  usePathname: () => "/strain/strain-backend-901",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/strain-view/server", () => ({ getStrain: mocks.getStrain }));

import StrainPage, { generateMetadata } from "../page";

const strain = {
  id: "strain-backend-901",
  strain: "A/California/04/2009",
  species: "Influenza A virus",
  subtype: "H1N1",
  segment_count: 8,
  status: "Complete",
  genome_ids: ["641501.3", "641501.4"],
};

describe("Strain member route", () => {
  beforeEach(() => {
    mocks.getStrain.mockReset();
    mocks.notFound.mockClear();
    mocks.getStrain.mockResolvedValue(strain);
  });

  it("renders the strain overview, summary, and genome list link", async () => {
    render(
      await StrainPage({
        params: Promise.resolve({ strainId: "strain-backend-901" }),
      }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "A/California/04/2009" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Segments and genomes")).toBeInTheDocument();
    expect(screen.getByText("Subtype:").parentElement).toHaveTextContent(
      "Subtype: H1N1",
    );
    expect(screen.getByRole("link", { name: /View genomes/ })).toHaveAttribute(
      "href",
      "/genome?rql=in(genome_id,(641501.3,641501.4))",
    );
    await expect(
      generateMetadata({
        params: Promise.resolve({ strainId: "strain-backend-901" }),
      }),
    ).resolves.toMatchObject({
      title: "A/California/04/2009 | Strain",
      description: "Influenza A virus",
    });
  });

  it("offers no genome list for a strain without genomes", async () => {
    mocks.getStrain.mockResolvedValue({ ...strain, genome_ids: [] });
    render(
      await StrainPage({
        params: Promise.resolve({ strainId: "strain-backend-901" }),
      }),
    );
    expect(
      screen.queryByRole("link", { name: /View genomes/ }),
    ).not.toBeInTheDocument();
  });

  it("resolves one identifier from both entry points for a percent-bearing ID", async () => {
    // The page component receives `encodeURIComponent(id)` and
    // `generateMetadata` the decoded `id`; see `readRouteParam`.
    const percentId = "strain%2F1";

    await StrainPage({
      params: Promise.resolve({ strainId: encodeURIComponent(percentId) }),
    });
    await generateMetadata({ params: Promise.resolve({ strainId: percentId }) });

    const requestedIds = mocks.getStrain.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(requestedIds).toEqual([percentId, percentId]);
  });

  it("uses notFound for absent and inaccessible records", async () => {
    mocks.getStrain.mockResolvedValue(null);
    await expect(
      StrainPage({ params: Promise.resolve({ strainId: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getStrain.mockRejectedValue(
      new DataApiError("Forbidden", 403, "forbidden"),
    );
    await expect(
      StrainPage({ params: Promise.resolve({ strainId: "strain-backend-901" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("preserves upstream failures", async () => {
    mocks.getStrain.mockRejectedValue(new Error("Strain backend unavailable"));
    await expect(
      StrainPage({ params: Promise.resolve({ strainId: "strain-backend-901" }) }),
    ).rejects.toThrow("Strain backend unavailable");
  });
});
