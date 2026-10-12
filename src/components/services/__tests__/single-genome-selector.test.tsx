import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { server } from "@/test-helpers/msw-server";

// jsdom's HTMLElement.scrollIntoView is undefined; the genome typeahead calls
// it when the pointer highlights a suggestion.
Element.prototype.scrollIntoView = vi.fn();

const genomes = [
  { genome_id: "83332.12", genome_name: "Mycobacterium tuberculosis H37Rv" },
];

function serveGenomes() {
  const queries: (string | null)[] = [];
  server.use(
    http.get("*/api/services/genome/search", ({ request }) => {
      queries.push(new URL(request.url).searchParams.get("q"));
      return HttpResponse.json({ results: genomes });
    }),
  );
  return queries;
}

describe("SingleGenomeSelector dropdown toggle", () => {
  it("lists genomes when enabled", async () => {
    serveGenomes();
    const user = userEvent.setup();
    render(<SingleGenomeSelector value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Toggle dropdown" }));

    expect(
      await screen.findByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).toBeInTheDocument();
  });

  it("is disabled with the field, and opens nothing when clicked", async () => {
    const queries = serveGenomes();
    const user = userEvent.setup();
    render(<SingleGenomeSelector value="" onChange={vi.fn()} disabled />);

    const toggle = screen.getByRole("button", { name: "Toggle dropdown" });
    expect(toggle).toBeDisabled();
    await user.click(toggle);

    expect(screen.queryByText("Searching...")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).not.toBeInTheDocument();
    expect(queries).toEqual([]);
  });

  it("closes an open list when the field becomes disabled", async () => {
    serveGenomes();
    const user = userEvent.setup();
    const { rerender } = render(
      <SingleGenomeSelector value="" onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Toggle dropdown" }));
    expect(
      await screen.findByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).toBeInTheDocument();

    rerender(<SingleGenomeSelector value="" onChange={vi.fn()} disabled />);

    expect(
      screen.queryByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).not.toBeInTheDocument();

    // Enabled again (the Align action re-added), it stays closed.
    rerender(<SingleGenomeSelector value="" onChange={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).not.toBeInTheDocument();
  });
});
