import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React from "react";

import BlastServicePage from "@/app/services/(genomics)/blast/page";
import { ServiceDebuggingProvider } from "@/contexts/service-debugging-context";
import { AuthBoundary } from "@/lib/auth/provider";
import { server } from "@/test-helpers/msw-server";
import { testAuthUser } from "@/test-helpers/react";

function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBoundary user={testAuthUser}>
        <ServiceDebuggingProvider>{children}</ServiceDebuggingProvider>
      </AuthBoundary>
    </QueryClientProvider>
  );
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: RegExp,
) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

function databaseType() {
  return screen.getByRole("combobox", { name: "Database Type" });
}

describe("BLAST page database type transitions", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    server.use(
      http.get("*/api/auth/profile", () =>
        HttpResponse.json({ settings: { default_job_folder: "" } }),
      ),
      http.post("*/api/services/workspace", async ({ request }) => {
        const body = (await request.json()) as { method?: string };
        if (body.method === "Workspace.get") {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json([]);
      }),
    );
  });

  it("preserves compatible choices and normalizes incompatible program and database transitions", async () => {
    const user = userEvent.setup();
    render(<BlastServicePage />, { wrapper: Providers });

    expect(databaseType()).toHaveTextContent("Genome sequences (NT)");

    await chooseOption(user, "Database Type", /^Genes \(NT\)$/i);
    expect(databaseType()).toHaveTextContent("Genes (NT)");

    await user.click(screen.getByRole("radio", { name: /^tblastn /i }));
    expect(databaseType()).toHaveTextContent("Genes (NT)");

    await chooseOption(
      user,
      "Database Source",
      /^Search within selected genome list$/i,
    );
    expect(databaseType()).toHaveTextContent("Genes (NT)");

    await chooseOption(
      user,
      "Database Source",
      /^Search within selected FASTA file$/i,
    );
    expect(databaseType()).toHaveTextContent("Genome sequences (NT)");

    await user.click(screen.getByRole("radio", { name: /^blastp /i }));
    expect(databaseType()).toHaveTextContent("Proteins (AA)");

    await user.click(screen.getByRole("radio", { name: /^blastx /i }));
    expect(databaseType()).toHaveTextContent("Proteins (AA)");

    await user.click(screen.getByRole("radio", { name: /^blastn /i }));
    expect(databaseType()).toHaveTextContent("Genome sequences (NT)");
  }, 10_000);

  it("prefills a selected Taxon list from the Taxonomy service action", async () => {
    sessionStorage.setItem(
      "taxonomy-blast",
      JSON.stringify({
        db_precomputed_database: "selTaxon",
        db_source: "taxon_list",
        db_taxon_list: ["234", "10239"],
      }),
    );
    window.history.replaceState({}, "", "/?rerun_key=taxonomy-blast");

    render(<BlastServicePage />, { wrapper: Providers });

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "Database Source" }),
      ).toHaveTextContent("Search within a taxon");
    });

    // The point of the prefill: both Taxon IDs are visible and removable, not just
    // the database source that implies them.
    const selectedTaxa = await screen.findByRole("list", {
      name: "Selected taxa",
    });
    expect(
      within(selectedTaxa)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["234", "10239"]);
    expect(
      screen.getByRole("button", { name: "Remove taxon 234" }),
    ).toBeInTheDocument();
  });

  it("normalizes incompatible rerun data and reset restores the complete default combination", async () => {
    sessionStorage.setItem(
      "blast-database-types",
      JSON.stringify({
        blast_program: "blastp",
        db_precomputed_database: "selGenome",
        db_type: "fna",
      }),
    );
    window.history.replaceState({}, "", "/?rerun_key=blast-database-types");
    const user = userEvent.setup();

    render(<BlastServicePage />, { wrapper: Providers });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /^blastp /i })).toBeChecked();
      expect(
        screen.getByRole("combobox", { name: "Database Source" }),
      ).toHaveTextContent("Search within selected genome list");
      expect(databaseType()).toHaveTextContent("Proteins (AA)");
    });

    await user.click(screen.getByRole("button", { name: /^reset$/i }));

    expect(screen.getByRole("radio", { name: /^blastn /i })).toBeChecked();
    expect(
      screen.getByRole("combobox", { name: "Database Source" }),
    ).toHaveTextContent(
      "Reference and representative genomes (bacteria, archaea)",
    );
    expect(databaseType()).toHaveTextContent("Genome sequences (NT)");
  });
});
