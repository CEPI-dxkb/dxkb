import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";

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

describe("SingleGenomeSelector prefilled genome ID", () => {
  it("shows the genome's name when the lookup answers", async () => {
    server.use(
      http.post("*/api/services/genome/by-ids", () =>
        HttpResponse.json({ results: genomes }),
      ),
    );
    render(<SingleGenomeSelector value="83332.12" onChange={vi.fn()} />);

    expect(
      await screen.findByDisplayValue("Mycobacterium tuberculosis H37Rv"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the ID, says why its name is missing, and does not search for the ID", async () => {
    const queries = serveGenomes();
    server.use(
      http.post("*/api/services/genome/by-ids", () =>
        HttpResponse.json(
          {
            error:
              "The BV-BRC data service did not respond (timed out after 20 s).",
            code: "upstream",
          },
          { status: 504 },
        ),
      ),
    );
    render(<SingleGenomeSelector value="83332.12" onChange={vi.fn()} />);

    const note = await screen.findByRole("alert");
    expect(note).toHaveTextContent(
      "Name could not be loaded: The BV-BRC data service did not respond (timed out after 20 s).",
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("83332.12");
    expect(input).toHaveAccessibleDescription(note.textContent);
    // Give a debounced name search the time it would take to fire.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(queries).toEqual([]);
  });

  it("notes an ID with no genome record", async () => {
    server.use(
      http.post("*/api/services/genome/by-ids", () =>
        HttpResponse.json({ results: [] }),
      ),
    );
    render(<SingleGenomeSelector value="1.1" onChange={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No genome record was found for 1.1.",
    );
  });

  it("drops the note once the user types", async () => {
    server.use(
      http.post("*/api/services/genome/by-ids", () =>
        HttpResponse.json({ error: "fetch failed" }, { status: 502 }),
      ),
    );
    serveGenomes();
    const user = userEvent.setup();
    render(<SingleGenomeSelector value="83332.12" onChange={vi.fn()} />);

    await screen.findByRole("alert");
    await user.type(screen.getByRole("textbox"), "4");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("SingleGenomeSelector failed search", () => {
  it("offers a Retry that runs the search again", async () => {
    let attempts = 0;
    server.use(
      http.get("*/api/services/genome/search", () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json(
              { error: "Genome search unavailable: BV-BRC genome search failed: 503" },
              { status: 503 },
            )
          : HttpResponse.json({ results: genomes });
      }),
    );
    const user = userEvent.setup();
    render(<SingleGenomeSelector value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Toggle dropdown" }));
    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("button", { name: /Mycobacterium tuberculosis/ }),
    ).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
});

// A form field that passes the selector its own value back, as the service
// pages do with `value={field.state.value} onChange={field.handleChange}`.
function ControlledSelector({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <SingleGenomeSelector value={value} onChange={setValue} />
      <output aria-label="Field value">{value}</output>
      <button
        type="button"
        onClick={() => {
          setValue("");
        }}
      >
        Reset field
      </button>
    </>
  );
}

describe("SingleGenomeSelector in a controlled field", () => {
  function answerByIds(response: () => Response) {
    server.use(http.post("*/api/services/genome/by-ids", response));
  }

  it("keeps what the user types after a failed prefill lookup", async () => {
    answerByIds(() =>
      HttpResponse.json(
        {
          error:
            "The BV-BRC data service did not respond (timed out after 20 s).",
          code: "upstream",
        },
        { status: 504 },
      ),
    );
    serveGenomes();
    const user = userEvent.setup();
    render(<ControlledSelector initialValue="83332.12" />);
    await screen.findByRole("alert");

    await user.type(screen.getByRole("textbox"), "4");

    expect(screen.getByRole("textbox")).toHaveValue("83332.124");
    // The edit still drops the kept ID from the field.
    expect(
      screen.getByRole("status", { name: "Field value" }),
    ).toBeEmptyDOMElement();
  });

  it("keeps what the user types after a prefilled genome resolves", async () => {
    answerByIds(() => HttpResponse.json({ results: genomes }));
    serveGenomes();
    const user = userEvent.setup();
    render(<ControlledSelector initialValue="83332.12" />);
    await screen.findByDisplayValue("Mycobacterium tuberculosis H37Rv");

    await user.type(screen.getByRole("textbox"), "4");

    expect(screen.getByRole("textbox")).toHaveValue(
      "Mycobacterium tuberculosis H37Rv4",
    );
    expect(
      screen.getByRole("status", { name: "Field value" }),
    ).toBeEmptyDOMElement();
  });

  it("still clears the input when the field is reset", async () => {
    answerByIds(() => HttpResponse.json({ results: genomes }));
    const user = userEvent.setup();
    render(<ControlledSelector initialValue="83332.12" />);
    await screen.findByDisplayValue("Mycobacterium tuberculosis H37Rv");

    await user.click(screen.getByRole("button", { name: "Reset field" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("");
    });
  });

  it("still clears a kept ID when the field is reset", async () => {
    answerByIds(() =>
      HttpResponse.json({ error: "fetch failed" }, { status: 502 }),
    );
    const user = userEvent.setup();
    render(<ControlledSelector initialValue="83332.12" />);
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Reset field" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("");
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
