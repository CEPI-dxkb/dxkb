import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { vi } from "vitest";

vi.mock("@/lib/services/organisms/summary", () => ({
  fetchOrganismSummary: vi.fn(),
}));
vi.mock("@/lib/services/organisms/genome-count", () => ({
  fetchTaxonGenomeCount: vi.fn(),
}));

import { DataSummary } from "../data-summary";
import { fetchTaxonGenomeCount } from "@/lib/services/organisms/genome-count";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";

const summary = {
  count: 1337420,
  uniqueFamily: 391,
  uniqueGenus: 5432,
  uniqueSpecies: 82915,
  cds: 482001224,
  matPeptide: 23144,
  pdb: 9821,
};

async function renderServer(node: Promise<React.ReactElement>) {
  const resolved = await node;
  return render(<Suspense fallback={null}>{resolved}</Suspense>);
}

describe("DataSummary", () => {
  beforeEach(() => {
    vi.mocked(fetchOrganismSummary).mockReset();
    vi.mocked(fetchTaxonGenomeCount).mockReset();
  });

  it("renders all KPI cards with formatted values", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce(summary);
    vi.mocked(fetchTaxonGenomeCount).mockResolvedValueOnce(1_300_000);

    await renderServer(DataSummary({ taxonId: 2 }));

    expect(screen.getByText("Families")).toBeInTheDocument();
    expect(screen.getByText("482,001,224")).toBeInTheDocument();
  });

  it("shows the Taxonomy header's genome count in the Genomes tile, not the summary's", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce(summary);
    vi.mocked(fetchTaxonGenomeCount).mockResolvedValueOnce(1_300_000);

    await renderServer(DataSummary({ taxonId: 2 }));

    expect(screen.getByTestId("organism-kpi-count")).toHaveTextContent(
      "1,300,000",
    );
    expect(screen.queryByText("1,337,420")).not.toBeInTheDocument();
    // A landing page is public, so the count is requested without a token.
    expect(fetchTaxonGenomeCount).toHaveBeenCalledWith(2);
  });

  it("rejects when the genome count fails, like a failed summary", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce(summary);
    vi.mocked(fetchTaxonGenomeCount).mockRejectedValueOnce(
      new Error("count down"),
    );

    await expect(DataSummary({ taxonId: 2 })).rejects.toThrow("count down");
  });

  it("rejects when the summary fails", async () => {
    vi.mocked(fetchOrganismSummary).mockRejectedValueOnce(
      new Error("summary down"),
    );
    vi.mocked(fetchTaxonGenomeCount).mockResolvedValueOnce(1_300_000);

    await expect(DataSummary({ taxonId: 2 })).rejects.toThrow("summary down");
  });
});
