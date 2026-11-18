import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ExperimentBiosetCollection } from "../experiment-bioset-collection";
import { createQueryClientWrapper } from "@/test-helpers/react";

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
      <ExperimentBiosetCollection
        baseRql="eq(taxon_lineage_ids,10239)"
        maxExperiments={5000}
      />,
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
        limit: 5001,
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

  it("asks to refine when more experiments match than the cap", async () => {
    mocks.exportRecords.mockResolvedValue({
      rows: [{ exp_id: "1" }, { exp_id: "2" }, { exp_id: "3" }],
    });
    render(
      <ExperimentBiosetCollection
        baseRql="eq(taxon_lineage_ids,2)"
        maxExperiments={2}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(
      await screen.findByText("Refine the Experiment search"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("bioset-collection")).toBeNull();
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
