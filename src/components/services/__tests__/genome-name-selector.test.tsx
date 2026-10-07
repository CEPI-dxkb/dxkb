import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { GenomeNameSelector } from "@/components/services/genome-name-selector";
import { server } from "@/test-helpers/msw-server";

// jsdom's HTMLElement.scrollIntoView is undefined; the genome typeahead calls
// it when the pointer highlights a suggestion.
Element.prototype.scrollIntoView = vi.fn();

const genomes = [
  {
    genome_id: "55951.466",
    genome_name: "Grapevine leafroll-associated virus 3",
  },
  { genome_id: "83332.12", genome_name: "Mycobacterium tuberculosis H37Rv" },
];

describe("GenomeNameSelector suggestions toggle", () => {
  it("lists genomes for an empty query and closes again", async () => {
    const queries: (string | null)[] = [];
    server.use(
      http.get("*/api/services/genome/search", ({ request }) => {
        queries.push(new URL(request.url).searchParams.get("q"));
        return HttpResponse.json({ results: genomes });
      }),
    );
    const user = userEvent.setup();
    render(<GenomeNameSelector onSelect={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Show suggestions" }));

    expect(
      await screen.findByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).toBeInTheDocument();
    expect(queries).toEqual([""]);

    await user.click(screen.getByRole("button", { name: "Hide suggestions" }));

    expect(
      screen.queryByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show suggestions" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("searches the text already typed, even below the typing threshold", async () => {
    const queries: (string | null)[] = [];
    server.use(
      http.get("*/api/services/genome/search", ({ request }) => {
        queries.push(new URL(request.url).searchParams.get("q"));
        return HttpResponse.json({ results: [genomes[0]] });
      }),
    );
    const user = userEvent.setup();
    render(<GenomeNameSelector onSelect={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("Genome..."), "Gr");
    await user.click(screen.getByRole("button", { name: "Show suggestions" }));

    expect(
      await screen.findByRole("button", { name: /Grapevine leafroll/ }),
    ).toBeInTheDocument();
    expect(queries).toEqual(["Gr"]);
  });

  it("adds a genome picked from the opened list", async () => {
    server.use(
      http.get("*/api/services/genome/search", () =>
        HttpResponse.json({ results: genomes }),
      ),
    );
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<GenomeNameSelector onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Show suggestions" }));
    await user.click(
      await screen.findByRole("button", { name: /Grapevine leafroll/ }),
    );
    await user.click(screen.getByRole("button", { name: "Add genome" }));

    expect(onSelect).toHaveBeenCalledWith(genomes[0]);
  });

  it("disables the toggle once the selection limit is reached", () => {
    render(
      <GenomeNameSelector
        onSelect={vi.fn()}
        selectedGenomeIds={["55951.466"]}
        maxSelections={1}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Show suggestions" }),
    ).toBeDisabled();
  });
});
