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
  it("treats a whitespace-only keyword as unscoped without exporting experiment IDs", () => {
    render(
      <ExperimentBiosetCollection
        experimentState={{
          keyword: "   ",
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
});
