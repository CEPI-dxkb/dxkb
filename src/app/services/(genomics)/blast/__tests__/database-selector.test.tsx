import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "@tanstack/react-form";
import { http, HttpResponse } from "msw";

import { DatabaseSelector } from "../database-selector";
import { TaxIDSelector } from "@/components/taxonomy/tax-id-selector";
import {
  completeFormSchema,
  defaultBlastFormValues,
  type BlastFormData,
} from "@/lib/forms/(genomics)/blast/blast-form-schema";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import type { TaxonomyItem } from "@/types";

function ControlledTaxIDSelector() {
  const [value, setValue] = useState<TaxonomyItem | null>({
    taxon_id: 234,
    taxon_name: "Brucellaceae",
  });

  return <TaxIDSelector value={value} onChange={setValue} />;
}

function DatabaseSelectorHarness() {
  const form = useForm({
    defaultValues: {
      ...defaultBlastFormValues,
      db_precomputed_database: "selTaxon",
      db_taxon_list: [],
    } as BlastFormData,
    validators: { onChange: completeFormSchema, onSubmit: completeFormSchema },
  });

  return (
    <>
      <DatabaseSelector form={form} database="selTaxon" preset="featureFasta" />
      <button
        type="button"
        onClick={() => {
          form.setFieldValue("db_taxon_list", ["10239"]);
        }}
      >
        Apply rerun taxa
      </button>
    </>
  );
}

describe("TaxIDSelector", () => {
  it("clears the displayed ID when its value is cleared", () => {
    server.use(
      http.get("*/api/services/taxonomy", () =>
        HttpResponse.json({ response: { docs: [] } }),
      ),
    );
    const { rerender } = render(
      <TaxIDSelector
        value={{ taxon_id: 234, taxon_name: "Brucellaceae" }}
        onChange={vi.fn()}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(screen.getByRole("textbox")).toHaveValue("234");

    rerender(<TaxIDSelector value={null} onChange={vi.fn()} />);

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("preserves a new query while clearing the previous selection", async () => {
    server.use(
      http.get("*/api/services/taxonomy", () =>
        HttpResponse.json({ response: { docs: [] } }),
      ),
    );
    const user = userEvent.setup();
    render(<ControlledTaxIDSelector />, {
      wrapper: createQueryClientWrapper(),
    });

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "10239");

    expect(input).toHaveValue("10239");
  });
});

describe("DatabaseSelector", () => {
  it("clears the pending taxon when rerun data replaces the taxon list", async () => {
    server.use(
      http.get("*/api/services/taxonomy", () =>
        HttpResponse.json({
          response: {
            docs: [{ taxon_id: 234, taxon_name: "Brucellaceae" }],
          },
        }),
      ),
    );
    const user = userEvent.setup();
    render(<DatabaseSelectorHarness />, {
      wrapper: createQueryClientWrapper(),
    });

    const input = screen.getByPlaceholderText("NCBI Taxonomy ID...");
    await user.type(input, "234");
    await user.click(
      await screen.findByRole("button", { name: "234 [Brucellaceae]" }),
    );
    expect(input).toHaveValue("234");

    await user.click(screen.getByRole("button", { name: "Apply rerun taxa" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("NCBI Taxonomy ID...")).toHaveValue("");
    });
    expect(screen.queryByText("234")).not.toBeInTheDocument();
    expect(screen.getByText("10239")).toBeInTheDocument();
  });
});
