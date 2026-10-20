import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Suspense } from "react";

import type { StatisticCounts } from "@/lib/services/statistics";

vi.mock("@/lib/services/statistics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/statistics")>(
    "@/lib/services/statistics",
  );
  return {
    ...actual,
    fetchDbStatistics: vi.fn(),
  };
});

import { fetchDbStatistics } from "@/lib/services/statistics";
import DBStatistics from "@/components/statistics/db-statistics";

const mockedFetch = vi.mocked(fetchDbStatistics);

function allNumeric(): StatisticCounts {
  return {
    viralGenomes: 42891,
    proteinEntries: 156742,
    virusSpecies: 8453,
    epitopes: 12389,
    taxons: 23456,
    proteinStructures: 7890,
    proteinFeatures: 34567,
    genomes: 98765,
  };
}

async function renderServer(node: Promise<React.ReactElement>) {
  const resolved = await node;
  return render(<Suspense fallback={null}>{resolved}</Suspense>);
}

describe("DBStatistics", () => {
  it("renders all 8 cards with thousands-separated numbers when every count succeeds", async () => {
    mockedFetch.mockResolvedValueOnce({
      counts: allNumeric(),
      unavailableReason: null,
    });

    const { findByText } = await renderServer(DBStatistics());

    expect(await findByText("42,891")).toBeInTheDocument();
    expect(await findByText("156,742")).toBeInTheDocument();
    expect(await findByText("8,453")).toBeInTheDocument();
    expect(await findByText("12,389")).toBeInTheDocument();
    expect(await findByText("23,456")).toBeInTheDocument();
    expect(await findByText("7,890")).toBeInTheDocument();
    expect(await findByText("34,567")).toBeInTheDocument();
    expect(await findByText("98,765")).toBeInTheDocument();

    expect(await findByText("Viral Genomes")).toBeInTheDocument();
    expect(await findByText("Protein Structures")).toBeInTheDocument();
    expect(await findByText("Genomes")).toBeInTheDocument();
  });

  it("renders an em dash for any metric whose count is null", async () => {
    mockedFetch.mockResolvedValueOnce({
      counts: { ...allNumeric(), proteinStructures: null, epitopes: null },
      unavailableReason: null,
    });

    const { findAllByText, findByText } = await renderServer(DBStatistics());

    const dashes = await findAllByText("—");
    expect(dashes).toHaveLength(2);
    expect(await findByText("42,891")).toBeInTheDocument();
  });

  it("says once that the statistics are unavailable, with the reason, when every count failed", async () => {
    const reason =
      "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance).";
    mockedFetch.mockResolvedValueOnce({
      counts: Object.fromEntries(
        Object.keys(allNumeric()).map((key) => [key, null]),
      ) as StatisticCounts,
      unavailableReason: reason,
    });

    const { findByRole, queryAllByText, queryByText } = await renderServer(
      DBStatistics(),
    );

    expect(await findByRole("alert")).toHaveTextContent(
      `Statistics temporarily unavailable: ${reason}`,
    );
    expect(queryAllByText("—")).toHaveLength(0);
    expect(queryByText("Viral Genomes")).not.toBeInTheDocument();
  });

  it("says so without a reason when the failure carried no message", async () => {
    mockedFetch.mockResolvedValueOnce({
      counts: Object.fromEntries(
        Object.keys(allNumeric()).map((key) => [key, null]),
      ) as StatisticCounts,
      unavailableReason: "",
    });

    const { findByRole } = await renderServer(DBStatistics());

    expect(await findByRole("alert")).toHaveTextContent(
      /^Statistics temporarily unavailable\.$/,
    );
  });
});
