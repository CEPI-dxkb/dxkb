import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";

import { server } from "@/test-helpers/msw-server";
import { connectTimeout, maintenancePage } from "@/test-helpers/upstream-failures";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

import AllOrganismsPage from "../all/page";
import BacteriaPage from "../bacteria/page";
import VirusesPage from "../viruses/page";

const { buildViews } = vi.hoisted(() => ({ buildViews: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/organisms",
  useSearchParams: () => new URLSearchParams(),
}));
// The real views render async server sections; this test is about whether the
// page reaches them, so it records what they were built from.
vi.mock("@/components/organisms/taxon-views", () => ({
  buildTaxonViews: (options: unknown) => buildViews(options) as unknown,
}));

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
  buildViews.mockReset();
  buildViews.mockReturnValue([
    { key: "overview", label: "Overview", icon: null, Component: () => <p>Featured organisms</p> },
    { key: "genomes", label: "Genomes", icon: null, Component: () => null, layout: "fill" },
  ]);
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

interface BuiltFrom {
  taxon: OrganismTaxonomy;
  scope: { kind: string; taxon?: OrganismTaxonomy; roots?: OrganismTaxonomy[] };
}

function builtFrom(): BuiltFrom {
  return buildViews.mock.calls[0]?.[0] as BuiltFrom;
}

describe("organism landings during a taxonomy outage", () => {
  it.each([
    ["Bacteria", BacteriaPage, { taxonId: 2, lineageIds: [131567, 2] }],
    ["Viruses", VirusesPage, { taxonId: 10239, lineageIds: [10239] }],
  ] as const)(
    "%s renders its shell, rail and static sections from the static root",
    async (name, Page, expected) => {
      server.use(http.get(`${baseUrl}/taxonomy/:taxonId`, () => maintenancePage()));

      render(await Page({ searchParams: Promise.resolve({}) }));

      expect(screen.getByRole("heading", { level: 1, name })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /Genomes/ }).length).toBeGreaterThan(0);
      expect(screen.getByText("Featured organisms")).toBeInTheDocument();
      expect(builtFrom().taxon).toMatchObject({ ...expected, genomes: null });
      expect(builtFrom().scope).toMatchObject({ kind: "lineage", taxon: expected });
    },
  );

  it("All Organisms survives one root timing out and keeps the other's real record", async () => {
    server.use(
      http.get(`${baseUrl}/taxonomy/131567`, () =>
        HttpResponse.json({
          taxon_id: 131567,
          taxon_name: "cellular organisms",
          lineage_names: ["cellular organisms"],
          lineage_ids: [131567],
          taxon_rank: "no rank",
          genomes: 9_800_000,
        }),
      ),
      http.get(`${baseUrl}/taxonomy/10239`, () => {
        throw connectTimeout();
      }),
    );

    render(await AllOrganismsPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { level: 1, name: "All Organisms" }),
    ).toBeInTheDocument();
    const roots = builtFrom().scope.roots ?? [];
    expect(roots.map((root) => root.taxonId)).toEqual([131567, 10239]);
    expect(roots[0]?.genomes).toBe(9_800_000);
    expect(roots[1]).toMatchObject({ taxonName: "Viruses", lineageIds: [10239], genomes: null });
  });
});
