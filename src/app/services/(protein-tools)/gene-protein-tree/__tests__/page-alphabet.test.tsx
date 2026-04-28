import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React from "react";

import GeneProteinTreePage from "@/app/services/(protein-tools)/gene-protein-tree/page";
import { ServiceDebuggingProvider } from "@/contexts/service-debugging-context";
import { AuthBoundary } from "@/lib/auth/provider";
import { memoryAuthAdapter } from "@/lib/auth/adapters/memory";
import { server } from "@/test-helpers/msw-server";

function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const port = memoryAuthAdapter({
    initialSession: {
      username: "testuser",
      email: "test@example.com",
      token: "test-token",
      email_verified: true,
    },
    onRequest: (input, init) => fetch(input, init),
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBoundary
        port={port}
        initialUser={{
          username: "testuser",
          email: "test@example.com",
          token: "test-token",
          email_verified: true,
        }}
      >
        <ServiceDebuggingProvider>{children}</ServiceDebuggingProvider>
      </AuthBoundary>
    </QueryClientProvider>
  );
}

/**
 * The page-level alphabet toggle is the only meaningful divergence between this form and the
 * Viral Genome Tree form (which the e2e `tree-services.spec.ts` covers as the family
 * representative). When the user flips DNA ↔ Protein mid-form, a useEffect filters the
 * sequences array down to the types that match the new alphabet. Silent data loss is the
 * concerning failure mode if the filter ever regresses, so the assertion below pins the
 * "DNA-only sequences are dropped, feature_group survives" contract.
 *
 * The reverse direction (Protein → DNA) is symmetric — the same filter applies with the
 * DNA-valid type set — so it is not asserted separately here.
 */
describe("GeneProteinTree page — alphabet toggle filters incompatible sequences", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    server.use(
      http.get("*/api/auth/profile", () =>
        HttpResponse.json({ settings: { default_job_folder: "" } }),
      ),
      // Workspace.get returns 500 so the OutputFolder name-availability check treats the name
      // as available (same trick as genome-assembly/page-rerun.test.tsx); other workspace RPCs
      // return [] for empty listings.
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

    // SelectedItemsTable renders both mobile + desktop variants, so each filename basename
    // appears multiple times. `getAllByText` keeps this resilient to that without coupling
    // the assertion to viewport-specific rendering.
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
});
