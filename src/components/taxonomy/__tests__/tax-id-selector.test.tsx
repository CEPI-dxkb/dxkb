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
    const suggestion = await screen.findByRole("button", {
      name: /562 \[Escherichia coli\]/,
    });
    expect(query).toBe("taxon_id:562");
    expect(
      screen.getByText("Bacteria > Escherichia > Escherichia coli"),
    ).toBeVisible();

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
