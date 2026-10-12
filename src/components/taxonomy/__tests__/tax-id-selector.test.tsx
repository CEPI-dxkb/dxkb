import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { TaxIDSelector } from "@/components/taxonomy/tax-id-selector";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

describe("TaxIDSelector search", () => {
  it("lists the proxy's array response and selects a numeric taxon ID", async () => {
    let query: string | null = null;
    server.use(
      http.get("*/api/services/taxonomy", ({ request }) => {
        query = new URL(request.url).searchParams.get("q");
        // BV-BRC's application/json reply: a bare array, taxon_id a string.
        return HttpResponse.json([
          {
            taxon_id: "562",
            taxon_name: "Escherichia coli",
            lineage_names: ["Bacteria", "Escherichia", "Escherichia coli"],
          },
        ]);
      }),
    );
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TaxIDSelector onChange={onChange} />, {
      wrapper: createQueryClientWrapper(),
    });

    const input = screen.getByRole("textbox");
    await user.type(input, "562");
    // The name on the first line, the ID under it, and no lineage.
    const suggestion = await screen.findByRole("button", {
      name: /Escherichia coli/,
    });
    expect(query).toBe("taxon_id:562");
    expect(suggestion).toHaveTextContent(/^Escherichia coli562$/);
    expect(
      screen.queryByText("Bacteria > Escherichia > Escherichia coli"),
    ).not.toBeInTheDocument();

    await user.click(suggestion);

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ taxon_id: 562, taxon_name: "Escherichia coli" }),
    );
    expect(input).toHaveValue("562");
  });

  it("shows the empty message when no taxon matches", async () => {
    server.use(
      http.get("*/api/services/taxonomy", () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    render(<TaxIDSelector />, { wrapper: createQueryClientWrapper() });

    await user.type(screen.getByRole("textbox"), "999999999");

    expect(
      await screen.findByText("No taxonomy found for ID: 999999999"),
    ).toBeVisible();
  });
});

describe("TaxIDSelector invalid", () => {
  it("draws the error border for a caller-reported failure without adding a message", () => {
    render(<TaxIDSelector invalid />, { wrapper: createQueryClientWrapper() });

    expect(screen.getByRole("textbox")).toHaveClass("border-destructive");
    expect(screen.queryByText("NCBI Tax ID is required.")).toBeNull();
  });

  it("keeps the default border until the required field is touched", async () => {
    const user = userEvent.setup();
    render(<TaxIDSelector required />, { wrapper: createQueryClientWrapper() });
    const input = screen.getByRole("textbox");

    expect(input).not.toHaveClass("border-destructive");

    await user.click(input);
    await user.tab();

    expect(input).toHaveClass("border-destructive");
    expect(screen.getByText("NCBI Tax ID is required.")).toBeVisible();
  });
});
