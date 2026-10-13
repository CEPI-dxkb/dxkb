import { render, screen } from "@testing-library/react";

const { notFoundSpy } = vi.hoisted(() => ({
  notFoundSpy: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

// The singular render path mounts OrganismLandingShell → LandingShellClient, which uses
// these navigation hooks; mock them as the taxonomy page test does.
vi.mock("next/navigation", () => ({
  notFound: () => notFoundSpy(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/genome/59201.7581",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// LandingShellClient also calls useHotkey; stub it so the render path doesn't throw.
vi.mock("@tanstack/react-hotkeys", () => ({ useHotkey: vi.fn() }));

import DomainsAndMotifsPage from "../domains-and-motifs/page";
import GenomePage from "../genome/[genomeId]/page";
import StrainListPage from "../strain/page";

vi.mock("../strain/strain-collection", () => ({
  StrainCollection: ({ initialState }: { initialState: unknown }) => (
    <div data-testid="strain-collection">{JSON.stringify(initialState)}</div>
  ),
}));

vi.mock("../domains-and-motifs/domains-and-motifs-collection", () => ({
  DomainsAndMotifsCollection: ({ initialState }: { initialState: unknown }) => (
    <div data-testid="domains-collection">{JSON.stringify(initialState)}</div>
  ),
}));

vi.mock("@/lib/genome-view/server", () => ({
  getGenome: vi.fn((genomeId: string) =>
    Promise.resolve({
      genome_id: genomeId,
      genome_name: "Test genome",
      superkingdom: "Bacteria",
    }),
  ),
}));

beforeEach(() => {
  notFoundSpy.mockClear();
});

it("genome singular renders for a dotted id", async () => {
  render(
    await GenomePage({
      params: Promise.resolve({ genomeId: "59201.7581" }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(
    screen.getByRole("heading", { name: "Test genome" }),
  ).toBeInTheDocument();
});

it("strain list parses canonical state", async () => {
  render(
    await StrainListPage({
      searchParams: Promise.resolve({
        keyword: "H1N1",
        strain: "A/B strain",
        page: "2",
      }),
    }),
  );
  expect(screen.getByTestId("strain-collection")).toHaveTextContent(
    '"keyword":"H1N1"',
  );
  expect(screen.getByTestId("strain-collection")).toHaveTextContent(
    '"strain":["A/B strain"]',
  );
  expect(screen.getByTestId("strain-collection")).toHaveTextContent('"page":2');
});

it("domains and motifs parses canonical list state", async () => {
  render(
    await DomainsAndMotifsPage({
      searchParams: Promise.resolve({
        keyword: "kinase",
        genome_id: "83332.12",
        source: ["InterPro", "CDD"],
        page: "2",
      }),
    }),
  );
  expect(screen.getByTestId("domains-collection")).toHaveTextContent(
    '"keyword":"kinase"',
  );
  expect(screen.getByTestId("domains-collection")).toHaveTextContent(
    '"genome_id":["83332.12"]',
  );
  expect(screen.getByTestId("domains-collection")).toHaveTextContent(
    '"source":["InterPro","CDD"]',
  );
  expect(screen.getByTestId("domains-collection")).toHaveTextContent(
    '"page":2',
  );
});

it("domains and motifs preserves a legacy RQL filter", async () => {
  render(
    await DomainsAndMotifsPage({
      searchParams: Promise.resolve({
        filter: "eq(source,InterPro)",
      }),
    }),
  );
  expect(screen.getByTestId("domains-collection")).toHaveTextContent(
    '"rql":"eq(source,InterPro)"',
  );
});

it("domains and motifs prefers canonical RQL over a legacy filter", async () => {
  render(
    await DomainsAndMotifsPage({
      searchParams: Promise.resolve({
        rql: "eq(source,CDD)",
        filter: "eq(source,InterPro)",
      }),
    }),
  );
  expect(screen.getByTestId("domains-collection")).toHaveTextContent(
    '"rql":"eq(source,CDD)"',
  );
});

it("genome singular calls notFound for an empty id", async () => {
  await expect(
    GenomePage({
      params: Promise.resolve({ genomeId: "" }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NEXT_NOT_FOUND");
  expect(notFoundSpy).toHaveBeenCalled();
});
