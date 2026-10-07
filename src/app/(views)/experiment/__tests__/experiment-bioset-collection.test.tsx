import { render, screen } from "@testing-library/react";
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

vi.mock("@/components/views", () => ({
  ResourceChildCollection: ({ rql }: { rql: string }) => (
    <div data-testid="bioset-collection" data-rql={rql} />
  ),
}));

describe("ExperimentBiosetCollection", () => {
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
});
