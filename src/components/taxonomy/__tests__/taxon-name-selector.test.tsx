import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";

import { TaxonNameSelector } from "@/components/taxonomy/taxon-name-selector";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import type { TaxonomyItem } from "@/types";

// `value` is always passed: the selector syncs `prevValue` (null) against the
// prop during render, so an omitted (undefined) value never settles.
describe("TaxonNameSelector invalid", () => {
  it("draws the error border for a caller-reported failure without adding a message", () => {
    render(<TaxonNameSelector value={null} invalid />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(screen.getByRole("textbox")).toHaveClass("border-destructive");
    expect(screen.queryByText("Taxonomy Name must be provided.")).toBeNull();
  });

  it("keeps the default border until the required field is touched", async () => {
    const user = userEvent.setup();
    render(<TaxonNameSelector value={null} required />, {
      wrapper: createQueryClientWrapper(),
    });
    const input = screen.getByRole("textbox");

    expect(input).not.toHaveClass("border-destructive");

    await user.click(input);
    await user.tab();

    expect(input).toHaveClass("border-destructive");
    expect(screen.getByText("Taxonomy Name must be provided.")).toBeVisible();
  });
});

describe("TaxonNameSelector suggestions", () => {
  it("puts one space on each side of the dot between the ID and the division", async () => {
    server.use(
      http.get("*/api/services/taxonomy", () =>
        HttpResponse.json([
          {
            taxon_id: 1392,
            taxon_name: "Bacillus anthracis",
            taxon_rank: "species",
            division: "Bacteria",
          },
          { taxon_id: 7, taxon_name: "Bacillus divisionless", taxon_rank: "species" },
        ]),
      ),
    );
    const user = userEvent.setup();
    render(<TaxonNameSelector value={null} />, {
      wrapper: createQueryClientWrapper(),
    });

    await user.type(screen.getByRole("textbox"), "Bacillus");

    // One text node, so the gap before the dot matches the gap after it
    // (a flex gap used to put 8px before it and a 4px space after).
    expect(await screen.findByText("ID: 1392 • Bacteria")).toBeVisible();
    expect(screen.getByText("ID: 7")).toBeVisible();
  });
});

describe("TaxonNameSelector external value changes", () => {
  function Harness({ initial }: { initial: TaxonomyItem | null }) {
    const [value, setValue] = useState<TaxonomyItem | null>(initial);
    return (
      <>
        <TaxonNameSelector value={value} onChange={setValue} />
        <button type="button" onClick={() => { setValue(null); }}>
          Clear from outside
        </button>
      </>
    );
  }

  it("drops the shown name when the value is cleared from outside", async () => {
    const user = userEvent.setup();
    render(
      <Harness initial={{ taxon_id: 1392, taxon_name: "Bacillus anthracis" }} />,
      { wrapper: createQueryClientWrapper() },
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Bacillus anthracis");

    await user.click(screen.getByRole("button", { name: "Clear from outside" }));

    expect(input).toHaveValue("");
  });

  it("keeps text the user is typing when that clears the selection", async () => {
    server.use(
      http.get("*/api/services/taxonomy", () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    render(
      <Harness initial={{ taxon_id: 1392, taxon_name: "Bacillus anthracis" }} />,
      { wrapper: createQueryClientWrapper() },
    );
    const input = screen.getByRole("textbox");

    await user.type(input, "x");

    expect(input).toHaveValue("Bacillus anthracisx");
  });
});

describe("TaxonNameSelector failed search", () => {
  const outage = "BV-BRC Taxonomy API error: 503 Service Unavailable";
  const shownOutage = `Taxonomy search unavailable: ${outage}`;

  /** The proxy's 503 until `recover()`, then one Mycobacterium match. */
  function failUntilRecovered() {
    let down = true;
    server.use(
      http.get("*/api/services/taxonomy", () =>
        down
          ? HttpResponse.json(
              { error: outage, code: "upstream" },
              { status: 503 },
            )
          : HttpResponse.json([
              {
                taxon_id: 1763,
                taxon_name: "Mycobacterium",
                taxon_rank: "genus",
              },
            ]),
      ),
    );
    return {
      recover: () => {
        down = false;
      },
    };
  }

  it("announces the proxy's reason with a Retry that searches again", async () => {
    const { recover } = failUntilRecovered();
    const user = userEvent.setup();
    render(<TaxonNameSelector value={null} />, {
      wrapper: createQueryClientWrapper(),
    });

    await user.type(screen.getByRole("textbox"), "Mycobacterium");

    expect(await screen.findByRole("alert")).toHaveTextContent(shownOutage);
    expect(screen.queryByText(/HTTP error/)).not.toBeInTheDocument();

    recover();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText("[genus] Mycobacterium"),
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the failure, not the required message, once the list closes, and retries from there", async () => {
    const { recover } = failUntilRecovered();
    const user = userEvent.setup();
    render(<TaxonNameSelector value={null} required />, {
      wrapper: createQueryClientWrapper(),
    });

    await user.type(screen.getByRole("textbox"), "Mycobacterium");
    await screen.findByRole("alert");
    await user.tab();

    expect(
      await screen.findByRole("button", { name: "Show suggestions" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(shownOutage);
    expect(screen.queryByText("Taxonomy Name must be provided.")).toBeNull();

    recover();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    // The retry refocuses the field, which reopens the list with the answer.
    expect(
      await screen.findByText("[genus] Mycobacterium"),
    ).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("shows the form's field error under the input, replaced by a failed search", async () => {
    failUntilRecovered();
    const user = userEvent.setup();
    render(
      <TaxonNameSelector value={null} fieldError="Taxonomy Name is required" />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(screen.getByText("Taxonomy Name is required")).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveClass("border-destructive");

    await user.type(screen.getByRole("textbox"), "Mycobacterium");
    await screen.findByRole("alert");

    expect(screen.queryByText("Taxonomy Name is required")).toBeNull();
  });

  it("keeps a picked value's field clear of a failed search", async () => {
    failUntilRecovered();
    const user = userEvent.setup();
    render(
      <TaxonNameSelector
        value={{ taxon_id: 1763, taxon_name: "Mycobacterium" }}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    // The prefilled name searches on mount. Its failure shows in the list,
    // which is where the user searches...
    await user.click(screen.getByRole("button", { name: "Show suggestions" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(shownOutage);

    // ...but not under a field that already holds its value.
    await user.click(screen.getByRole("button", { name: "Hide suggestions" }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
