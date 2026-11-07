import { render, screen } from "@testing-library/react";

import { LazyReferenceGenomesClient } from "../lazy-reference-genomes-client";

vi.mock("../reference-genomes-client", () => ({
  ReferenceGenomesClient: (props: { total: number }) => (
    <div data-testid="reference-genomes-client" data-total={props.total} />
  ),
}));

describe("LazyReferenceGenomesClient", () => {
  it("renders the card client with its props once the import resolves", async () => {
    render(
      <LazyReferenceGenomesClient
        rows={[]}
        counts={{}}
        total={7}
        hrefs={{ all: "/genome?tab=genomes", byType: {} }}
      />,
    );

    expect(await screen.findByTestId("reference-genomes-client")).toHaveAttribute(
      "data-total",
      "7",
    );
  });
});
