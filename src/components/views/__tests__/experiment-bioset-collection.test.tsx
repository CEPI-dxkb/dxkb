import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ExperimentBiosetCollection } from "../experiment-bioset-collection";
import { createQueryClientWrapper } from "@/test-helpers/react";
import {
  maxBiosetScopeExperiments,
  maxBiosetScopeRqlLength,
} from "@/lib/experiment-view";

const mocks = vi.hoisted(() => ({
  exportRecords: vi.fn(),
}));

vi.mock("@/lib/data-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data-api")>()),
  DataRepository: class {
    export = mocks.exportRecords;
  },
}));

vi.mock("@/components/views/resource-child-collection", () => ({
  ResourceChildCollection: ({ rql }: { rql: string }) => (
    <div data-testid="bioset-collection" data-rql={rql} />
  ),
}));

describe("ExperimentBiosetCollection", () => {
  beforeEach(() => {
    mocks.exportRecords.mockReset();
  });

  it("scopes a taxon's Biosets through its experiments, since biosets carry no taxon or genome fields", async () => {
    mocks.exportRecords.mockResolvedValue({
      rows: [{ exp_id: "170" }, { exp_id: "171" }],
    });
    render(
      <ExperimentBiosetCollection baseRql="eq(taxon_lineage_ids,10239)" />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(await screen.findByTestId("bioset-collection")).toHaveAttribute(
      "data-rql",
      "in(exp_id,(170,171))",
    );
    expect(mocks.exportRecords).toHaveBeenCalledWith(
      "experiment",
      expect.objectContaining({
        rql: "eq(taxon_lineage_ids,10239)",
        fields: ["exp_id"],
        limit: maxBiosetScopeExperiments + 1,
      }),
      expect.anything(),
    );
  });

  it("ands the taxon scope with the Experiment search", async () => {
    mocks.exportRecords.mockResolvedValue({ rows: [{ exp_id: "170" }] });
    render(
      <ExperimentBiosetCollection
        baseRql="eq(taxon_lineage_ids,2)"
        experimentState={{
          filters: {},
          page: 1,
          sort: "exp_id:asc",
          rql: "eq(exp_type,Proteomics)",
        }}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    await screen.findByTestId("bioset-collection");
    expect(mocks.exportRecords).toHaveBeenCalledWith(
      "experiment",
      expect.objectContaining({
        rql: "and(eq(taxon_lineage_ids,2),eq(exp_type,Proteomics))",
      }),
      expect.anything(),
    );
  });

  it("treats a blank baseRql as no scope, keeping the Experiment search", async () => {
    mocks.exportRecords.mockResolvedValue({ rows: [{ exp_id: "170" }] });
    render(
      <ExperimentBiosetCollection
        baseRql="  "
        experimentState={{
          filters: {},
          page: 1,
          sort: "exp_id:asc",
          rql: "eq(exp_type,Proteomics)",
        }}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(await screen.findByTestId("bioset-collection")).toHaveAttribute(
      "data-rql",
      "in(exp_id,(170))",
    );
    expect(mocks.exportRecords).toHaveBeenCalledWith(
      "experiment",
      expect.objectContaining({ rql: "eq(exp_type,Proteomics)" }),
      expect.anything(),
    );
  });

  // 1,000 six-digit IDs serialize to ~7,000 characters, past the scope budget.
  const tooManyIds = Array.from({ length: 1000 }, (_, i) => ({
    exp_id: String(100000 + i),
  }));

  it("links a taxon tab to the Experiment search when its scope is too long for one query", async () => {
    mocks.exportRecords.mockResolvedValue({ rows: tooManyIds });
    render(
      <ExperimentBiosetCollection
        baseRql="eq(taxon_lineage_ids,2)"
        refineHref="/experiment?rql=eq(taxon_lineage_ids,2)"
      />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(
      await screen.findByText("Too many Experiments to list their Biosets"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Narrow them in the Experiment search" }),
    ).toHaveAttribute("href", "/experiment?rql=eq(taxon_lineage_ids,2)");
    expect(screen.queryByTestId("bioset-collection")).toBeNull();
  });

  it("asks for a keyword or filter when the Experiment search is too broad and there is no refine link", async () => {
    mocks.exportRecords.mockResolvedValue({ rows: tooManyIds });
    render(
      <ExperimentBiosetCollection
        experimentState={{
          keyword: "coli",
          filters: {},
          page: 1,
          sort: "exp_id:asc",
        }}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(
      await screen.findByText(/Add a keyword or filter to narrow the results/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByTestId("bioset-collection")).toBeNull();
  });

  it("lists the Biosets of a scope that fits, in or-ed chunks", async () => {
    // 791 IDs, as Bacteria has: past one in() but within the length budget.
    mocks.exportRecords.mockResolvedValue({
      rows: Array.from({ length: 791 }, (_, i) => ({ exp_id: String(i + 1) })),
    });
    render(<ExperimentBiosetCollection baseRql="eq(taxon_lineage_ids,2)" />, {
      wrapper: createQueryClientWrapper(),
    });

    const rql =
      (await screen.findByTestId("bioset-collection")).getAttribute(
        "data-rql",
      ) ?? "";
    expect(rql).toMatch(/^or\(in\(exp_id,/);
    expect(rql.length).toBeLessThanOrEqual(maxBiosetScopeRqlLength);
  });

  it.each(["   ", '""', '"', "OR", "/"])("treats the keyword %j, which has no terms, as unscoped without exporting experiment IDs", (keyword) => {
    render(
      <ExperimentBiosetCollection
        experimentState={{
          keyword,
          filters: {},
          page: 1,
          sort: "exp_id:asc",
        }}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(screen.getByTestId("bioset-collection")).toHaveAttribute(
      "data-rql",
      "eq(bioset_id,*)",
    );
    expect(mocks.exportRecords).not.toHaveBeenCalled();
  });

  it("scopes to the experiments the Experiments tab lists, with the keyword exact", async () => {
    mocks.exportRecords.mockResolvedValue({ rows: [{ exp_id: "100" }] });
    render(
      <ExperimentBiosetCollection
        experimentState={{
          keyword: "coli",
          filters: {},
          page: 1,
          sort: "exp_id:asc",
        }}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(await screen.findByTestId("bioset-collection")).toHaveAttribute(
      "data-rql",
      "in(exp_id,(100))",
    );
    expect(mocks.exportRecords).toHaveBeenCalledWith(
      "experiment",
      expect.objectContaining({ keyword: "coli", keywordMode: "exact" }),
      expect.anything(),
    );
  });

  it("shows why the scoped experiments failed, with a Retry that refetches", async () => {
    mocks.exportRecords
      .mockRejectedValueOnce(
        new Error("The BV-BRC data service did not respond (timed out after 20 s)."),
      )
      .mockResolvedValueOnce({ rows: [{ exp_id: "100" }] });
    render(
      <ExperimentBiosetCollection
        experimentState={{
          keyword: "influenza",
          filters: {},
          page: 1,
          sort: "exp_id:asc",
        }}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load biosets");
    expect(alert).toHaveTextContent(
      "The BV-BRC data service did not respond (timed out after 20 s).",
    );

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByTestId("bioset-collection")).toHaveAttribute(
      "data-rql",
      "in(exp_id,(100))",
    );
    expect(mocks.exportRecords).toHaveBeenCalledTimes(2);
  });

  it("keeps the failure up, retrying, until the Retry answers", async () => {
    let release: (value: { rows: { exp_id: string }[] }) => void = () =>
      undefined;
    mocks.exportRecords
      .mockRejectedValueOnce(
        new Error("The BV-BRC data service did not respond (timed out after 20 s)."),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          release = resolve;
        }),
      );
    render(
      <ExperimentBiosetCollection
        experimentState={{
          keyword: "influenza",
          filters: {},
          page: 1,
          sort: "exp_id:asc",
        }}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    const alert = await screen.findByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(
      await within(alert).findByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(alert).toHaveTextContent(
      "The BV-BRC data service did not respond (timed out after 20 s).",
    );
    expect(
      screen.queryByRole("status", { name: "Loading Biosets" }),
    ).toBeNull();

    act(() => {
      release({ rows: [{ exp_id: "100" }] });
    });

    expect(await screen.findByTestId("bioset-collection")).toHaveAttribute(
      "data-rql",
      "in(exp_id,(100))",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
