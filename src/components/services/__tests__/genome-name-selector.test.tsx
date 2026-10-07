import { act, render, screen, waitFor } from "@testing-library/react";
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

  it("finishes a reopened search before the typing debounce fires", async () => {
    const queries: (string | null)[] = [];
    server.use(
      http.get("*/api/services/genome/search", ({ request }) => {
        queries.push(new URL(request.url).searchParams.get("q"));
        return HttpResponse.json({ results: [genomes[1]] });
      }),
    );
    const user = userEvent.setup();
    render(<GenomeNameSelector onSelect={vi.fn()} />);

    // Typing schedules a search; closing the list and opening it again
    // searches at once, and that answer arrives before the scheduled one.
    await user.type(screen.getByPlaceholderText("Genome..."), "Myco");
    await user.click(screen.getByRole("button", { name: "Hide suggestions" }));
    await user.click(screen.getByRole("button", { name: "Show suggestions" }));
    expect(
      await screen.findByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).toBeInTheDocument();
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));

    expect(screen.queryByText("Searching...")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add genome" })).toBeEnabled();
    expect(queries).toEqual(["Myco"]);
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

describe("GenomeNameSelector overlapping searches", () => {
  it("stops searching when a genome is picked while a search is running", async () => {
    const held = Promise.withResolvers<undefined>();
    server.use(
      http.get("*/api/services/genome/search", async ({ request }) => {
        const query = new URL(request.url).searchParams.get("q");
        if (query === "Myco") await held.promise;
        return HttpResponse.json({ results: [genomes[1]] });
      }),
    );
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<GenomeNameSelector onSelect={onSelect} />);
    const input = screen.getByPlaceholderText("Genome...");

    await user.type(input, "Myc");
    await screen.findByRole("button", { name: /Mycobacterium tuberculosis/ });
    // The next search hangs; the earlier answer is still what Enter picks.
    await user.type(input, "o");
    await screen.findByText("Searching...");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(input).toHaveValue(genomes[1].genome_name);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add genome" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Add genome" }));
    expect(onSelect).toHaveBeenCalledWith(genomes[1]);
    held.resolve(undefined);
  });

  it("drops the opened list's answer once the user types", async () => {
    const held = Promise.withResolvers<undefined>();
    server.use(
      http.get("*/api/services/genome/search", async ({ request }) => {
        const query = new URL(request.url).searchParams.get("q");
        if (query === "") {
          await held.promise;
          return HttpResponse.json({ results: genomes });
        }
        return HttpResponse.json({ results: [genomes[1]] });
      }),
    );
    const user = userEvent.setup();
    render(<GenomeNameSelector onSelect={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Show suggestions" }));
    await screen.findByText("Searching...");
    await user.type(screen.getByPlaceholderText("Genome..."), "Myco");
    held.resolve(undefined);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // The list for "" would include Grapevine; only the search for "Myco"
    // may fill it.
    expect(
      screen.queryByRole("button", { name: /Grapevine leafroll/ }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Grapevine leafroll/ }),
    ).not.toBeInTheDocument();
  });
});
