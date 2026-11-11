import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React from "react";

import GeneProteinTreePage from "@/app/services/(protein-tools)/gene-protein-tree/page";
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

describe("GeneProteinTree page — alphabet toggle filters incompatible sequences", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    server.use(
      // Workspace.get returns 500 so the output name counts as available; other RPCs return [].
      http.post("*/api/services/workspace", async ({ request }) => {
        const body = (await request.json()) as { method?: string };
        if (body.method === "Workspace.get") {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json([]);
      }),
    );
  });

  it("removes DNA-only sequences when switching alphabet to Protein, keeps feature_group", async () => {
    sessionStorage.setItem(
      "alphabet-test",
      JSON.stringify({
        alphabet: "DNA",
        recipe: "RAxML",
        substitution_model: "GTR",
        trim_threshold: 0.5,
        gap_threshold: 0.5,
        output_path: "/ws/testuser/out",
        output_file: "tree-test",
        sequences: [
          { filename: "/ws/testuser/group.fa", type: "feature_group" },
          { filename: "/ws/testuser/aligned.fa", type: "aligned_dna_fasta" },
          { filename: "/ws/testuser/unaligned.fa", type: "feature_dna_fasta" },
        ],
      }),
    );
    window.history.replaceState({}, "", "/?rerun_key=alphabet-test");

    render(<GeneProteinTreePage />, { wrapper: Providers });

    // Basenames appear twice per row and the regexes overlap, so count with getAllByText.
    await waitFor(() => {
      expect(screen.getAllByText(/group\.fa/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/aligned\.fa/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/unaligned\.fa/).length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getByRole("radio", { name: /^protein$/i }));

    await waitFor(() => {
      expect(screen.queryByText(/aligned\.fa/)).not.toBeInTheDocument();
      expect(screen.queryByText(/unaligned\.fa/)).not.toBeInTheDocument();
    });
    expect(screen.getAllByText(/group\.fa/).length).toBeGreaterThan(0);
  });

  it("names the FASTA selectors after the chosen alphabet", async () => {
    window.history.replaceState({}, "", "/");
    render(<GeneProteinTreePage />, { wrapper: Providers });

    expect(screen.getByText("DNA Aligned FASTA")).toBeInTheDocument();
    expect(screen.getByText("DNA Unaligned FASTA")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /^protein$/i }));

    expect(await screen.findByText("Protein Aligned FASTA")).toBeInTheDocument();
    expect(screen.getByText("Protein Unaligned FASTA")).toBeInTheDocument();
    expect(screen.queryByText(/^DNA (Un)?aligned FASTA$/i)).not.toBeInTheDocument();
  });
});
