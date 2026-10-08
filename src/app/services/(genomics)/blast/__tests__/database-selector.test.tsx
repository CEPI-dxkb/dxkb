import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
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

// jsdom's HTMLElement.scrollIntoView is undefined; the genome typeahead calls
// it when the pointer highlights a suggestion.
Element.prototype.scrollIntoView = vi.fn();

function GenomeListHarness({
  initialGenomeIds = [],
  rerunGenomeIds = ["55951.466"],
}: {
  initialGenomeIds?: string[];
  rerunGenomeIds?: string[];
}) {
  const form = useForm({
    defaultValues: {
      ...defaultBlastFormValues,
      db_precomputed_database: "selGenome",
      db_genome_list: initialGenomeIds,
    } as BlastFormData,
    validators: { onChange: completeFormSchema, onSubmit: completeFormSchema },
  });
  const genomeIds = useSelector(
    form.store,
    (state) => state.values.db_genome_list ?? [],
  );

  return (
    <>
      <DatabaseSelector form={form} database="selGenome" preset="featureFasta" />
      <output aria-label="Genome list value">{genomeIds.join(",")}</output>
      <button
        type="button"
        onClick={() => {
          form.setFieldValue("db_genome_list", rerunGenomeIds);
        }}
      >
        Apply rerun genomes
      </button>
    </>
  );
}

const grapevineGenomes = [
  {
    genome_id: "55951.466",
    genome_name: "Grapevine leafroll-associated virus 3",
    public: true,
  },
  {
    genome_id: "55951.1989",
    genome_name: "Grapevine leafroll-associated virus 3 GLRaV3-3203",
    public: true,
  },
];

describe("DatabaseSelector genome list", () => {
  it("searches genomes by name and adds the chosen one to the selected genomes table", async () => {
    let searchedFor: string | null = null;
    server.use(
      http.get("*/api/services/genome/search", ({ request }) => {
        searchedFor = new URL(request.url).searchParams.get("q");
        return HttpResponse.json({ results: grapevineGenomes });
      }),
    );
    const user = userEvent.setup();
    render(<GenomeListHarness />, { wrapper: createQueryClientWrapper() });

    await user.type(
      screen.getByPlaceholderText("e.g. M. tuberculosis CDC1551"),
      "Grapevine leafroll-associated virus 3",
    );
    await user.click(
      await screen.findByRole("button", { name: /GLRaV3-3203/ }),
    );
    await user.click(screen.getByRole("button", { name: "Add genome" }));

    expect(searchedFor).toBe("Grapevine leafroll-associated virus 3");
    const table = screen.getByRole("table", { name: "Selected genomes" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Genome", "Genome ID", "Remove"]);
    const [, row] = within(table).getAllByRole("row");
    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Grapevine leafroll-associated virus 3 GLRaV3-3203",
      "55951.1989",
      "",
    ]);
    expect(screen.getByText("Selected 1/20")).toBeInTheDocument();
    const value = screen.getByRole("status", { name: "Genome list value" });
    expect(value).toHaveTextContent("55951.1989");

    await user.click(
      within(row).getByRole("button", {
        name: "Remove Grapevine leafroll-associated virus 3 GLRaV3-3203",
      }),
    );

    expect(value).toBeEmptyDOMElement();
    expect(
      within(table).getByRole("cell", { name: "No genomes selected" }),
    ).toBeInTheDocument();
  });

  it("shows genome names for IDs restored from a rerun", async () => {
    server.use(
      http.post("*/api/services/genome/by-ids", () =>
        HttpResponse.json({ results: [grapevineGenomes[0]] }),
      ),
    );
    const user = userEvent.setup();
    render(<GenomeListHarness />, { wrapper: createQueryClientWrapper() });

    await user.click(
      screen.getByRole("button", { name: "Apply rerun genomes" }),
    );

    const table = screen.getByRole("table", { name: "Selected genomes" });
    expect(
      await within(table).findByRole("cell", {
        name: "Grapevine leafroll-associated virus 3",
      }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "55951.466" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Selected 1/20")).toBeInTheDocument();
  });

  it("shows the cached names when the field mounts with a rerun's IDs again", async () => {
    let lookups = 0;
    server.use(
      http.post("*/api/services/genome/by-ids", () => {
        lookups += 1;
        return HttpResponse.json({ results: [grapevineGenomes[0]] });
      }),
    );
    const user = userEvent.setup();
    const wrapper = createQueryClientWrapper();
    const { unmount } = render(<GenomeListHarness />, { wrapper });
    await user.click(
      screen.getByRole("button", { name: "Apply rerun genomes" }),
    );
    expect(
      await screen.findByRole("cell", {
        name: "Grapevine leafroll-associated virus 3",
      }),
    ).toBeInTheDocument();
    unmount();

    render(<GenomeListHarness initialGenomeIds={["55951.466"]} />, {
      wrapper,
    });

    expect(
      await screen.findByRole("cell", {
        name: "Grapevine leafroll-associated virus 3",
      }),
    ).toBeInTheDocument();
    expect(lookups).toBe(1);
  });

  it("keeps looked-up names when a row is removed and the next lookup fails", async () => {
    let lookups = 0;
    server.use(
      http.post("*/api/services/genome/by-ids", () => {
        lookups += 1;
        return lookups === 1
          ? HttpResponse.json({ results: grapevineGenomes })
          : HttpResponse.json(
              { error: "Data API unavailable" },
              { status: 503 },
            );
      }),
    );
    const user = userEvent.setup();
    render(
      <GenomeListHarness rerunGenomeIds={["55951.466", "55951.1989"]} />,
      { wrapper: createQueryClientWrapper() },
    );

    await user.click(
      screen.getByRole("button", { name: "Apply rerun genomes" }),
    );
    const table = screen.getByRole("table", { name: "Selected genomes" });
    await user.click(
      await within(table).findByRole("button", {
        name: "Remove Grapevine leafroll-associated virus 3",
      }),
    );

    expect(
      within(table).getByRole("cell", {
        name: "Grapevine leafroll-associated virus 3 GLRaV3-3203",
      }),
    ).toBeInTheDocument();
    expect(lookups).toBe(1);
  });

  it("falls back to the genome ID when the name lookup fails", async () => {
    server.use(
      http.post("*/api/services/genome/by-ids", () =>
        HttpResponse.json({ error: "Data API unavailable" }, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    render(<GenomeListHarness />, { wrapper: createQueryClientWrapper() });

    await user.click(
      screen.getByRole("button", { name: "Apply rerun genomes" }),
    );

    const table = screen.getByRole("table", { name: "Selected genomes" });
    expect(
      await within(table).findByRole("button", { name: "Remove 55951.466" }),
    ).toBeInTheDocument();
    expect(
      within(table).getAllByRole("cell", { name: "55951.466" }),
    ).toHaveLength(2);
    expect(screen.queryByText("No genomes selected")).not.toBeInTheDocument();
  });
});

describe("TaxIDSelector", () => {
  it("clears the displayed ID when its value is cleared", () => {
    server.use(
      http.get("*/api/services/taxonomy", () =>
        HttpResponse.json([]),
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
        HttpResponse.json([]),
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
        HttpResponse.json([{ taxon_id: "234", taxon_name: "Brucellaceae" }]),
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
