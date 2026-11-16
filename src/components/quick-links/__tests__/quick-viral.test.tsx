import { render } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";

import type { StatisticCounts } from "@/lib/services/statistics";
import type { QuickAccessKey } from "@/lib/services/quick-access-statistics";

vi.mock("@public/icons/protein.svg", () => ({ default: () => null }));
vi.mock("@public/icons/sequence.svg", () => ({ default: () => null }));
vi.mock("@public/icons/genome.svg", () => ({ default: () => null }));
vi.mock("@public/icons/pipeline.svg", () => ({ default: () => null }));

vi.mock("@/lib/services/quick-access-statistics", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/quick-access-statistics")
  >("@/lib/services/quick-access-statistics");
  return { ...actual, getQuickAccessStatistics: vi.fn() };
});

import { getQuickAccessStatistics } from "@/lib/services/quick-access-statistics";
import QuickViralLinks from "@/components/quick-links/quick-viral";
import QuickViralSkeleton from "@/components/quick-links/quick-viral-skeleton";

const mockedGetQuickAccessStatistics = vi.mocked(getQuickAccessStatistics);

function allNumeric(): StatisticCounts<QuickAccessKey> {
  return {
    completeGenomes: 10304885,
    partialGenomes: 4454982,
    referenceGenomes: 24911,
    experimentalStructures: 17243,
    predictedStructures: 29863,
    epitopes: 229258,
  };
}

function allNull(): StatisticCounts<QuickAccessKey> {
  return {
    completeGenomes: null,
    partialGenomes: null,
    referenceGenomes: null,
    experimentalStructures: null,
    predictedStructures: null,
    epitopes: null,
  };
}

async function renderServer(node: Promise<React.ReactElement>) {
  const resolved = await node;
  return render(<Suspense fallback={null}>{resolved}</Suspense>);
}

describe("QuickViralLinks", () => {
  it("shows each live count with a thousands separator beside a label that says what it counts", async () => {
    mockedGetQuickAccessStatistics.mockResolvedValueOnce({
      counts: allNumeric(),
      unavailableReason: null,
    });

    const { findByText } = await renderServer(QuickViralLinks());

    for (const text of [
      "10,304,885",
      "4,454,982",
      "24,911",
      "17,243",
      "29,863",
      "229,258",
    ]) {
      expect(await findByText(text)).toBeInTheDocument();
    }
    for (const label of [
      "Complete Genomes",
      "Partial Genomes",
      "Reference & Representative Genomes",
      "Experimental Structures",
      "Predicted Structures",
      "Viral Epitopes",
    ]) {
      expect(await findByText(label)).toBeInTheDocument();
    }
  });

  it("no longer shows any of the old hard-coded numbers", async () => {
    mockedGetQuickAccessStatistics.mockResolvedValueOnce({
      counts: allNumeric(),
      unavailableReason: null,
    });

    const { queryByText } = await renderServer(QuickViralLinks());

    for (const stale of ["24,891", "103,457", "1,204", "18,742", "31,205", "5,891"]) {
      expect(queryByText(stale)).not.toBeInTheDocument();
    }
  });

  it("shows an em dash for a count that failed and keeps the others", async () => {
    mockedGetQuickAccessStatistics.mockResolvedValueOnce({
      counts: { ...allNumeric(), epitopes: null },
      unavailableReason: null,
    });

    const { findAllByText, findByText, queryByRole } = await renderServer(
      QuickViralLinks(),
    );

    expect(await findAllByText("—")).toHaveLength(1);
    expect(await findByText("10,304,885")).toBeInTheDocument();
    expect(queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says why when every count failed, with the original reason, and keeps the cards", async () => {
    const reason =
      "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance).";
    mockedGetQuickAccessStatistics.mockResolvedValueOnce({
      counts: allNull(),
      unavailableReason: reason,
    });

    const { findByRole, findAllByText, findByText } = await renderServer(
      QuickViralLinks(),
    );

    expect(await findByRole("alert")).toHaveTextContent(
      `Counts temporarily unavailable: ${reason}`,
    );
    expect(await findAllByText("—")).toHaveLength(6);
    expect(await findByText("Viral Genomes")).toBeInTheDocument();
  });

  it("says so without a reason when the failure carried no message", async () => {
    mockedGetQuickAccessStatistics.mockResolvedValueOnce({
      counts: allNull(),
      unavailableReason: "",
    });

    const { findByRole } = await renderServer(QuickViralLinks());

    expect(await findByRole("alert")).toHaveTextContent(
      /^Counts temporarily unavailable\.$/,
    );
  });
});

describe("QuickViralSkeleton", () => {
  it("keeps the heading and card titles and swaps each badge for a placeholder", () => {
    const { container, getByText, queryByText } = render(<QuickViralSkeleton />);

    expect(getByText("Quick Access to Viral Data")).toBeInTheDocument();
    expect(getByText("Viral Genomes")).toBeInTheDocument();
    expect(getByText("Complete Genomes")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6);
    expect(queryByText("—")).not.toBeInTheDocument();
  });
});
