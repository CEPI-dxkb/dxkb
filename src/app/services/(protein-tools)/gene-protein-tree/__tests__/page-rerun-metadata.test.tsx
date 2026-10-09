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

/** Reruns a job with `metadata`, submits it, and returns the submitted app params. */
async function rerunAndSubmit(
  metadata: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  sessionStorage.setItem(
    "metadata-test",
    JSON.stringify({
      alphabet: "DNA",
      recipe: "RAxML",
      substitution_model: "GTR",
      output_path: "/ws/testuser/out",
      output_file: "tree-test",
      sequences: [{ filename: "/ws/testuser/group", type: "feature_group" }],
      ...metadata,
    }),
  );
  window.history.replaceState({}, "", "/?rerun_key=metadata-test");
  let submitted: { app_params: Record<string, unknown> } | null = null;
  server.use(
    http.post("*/api/services/app-service/submit", async ({ request }) => {
      submitted = (await request.json()) as typeof submitted;
      return HttpResponse.json({ job: [{ id: "job-tree" }] });
    }),
  );

  render(<GeneProteinTreePage />, { wrapper: Providers });
  const submit = screen.getByRole("button", { name: "Submit" });
  await waitFor(() => {
    expect(submit).toBeEnabled();
  });
  await userEvent.click(submit);
  await waitFor(() => {
    expect(submitted).not.toBeNull();
  });
  return (submitted as unknown as { app_params: Record<string, unknown> })
    .app_params;
}

/**
 * The GeneTree app reads `genome_metadata_fields` (genome fields) and
 * `feature_metadata_fields` (gene fields, which replace its default gene
 * labels). Metadata Options offers genome fields only, so a rerun submits
 * them all as genome fields, whichever key the job stored them under.
 */
describe("GeneProteinTree page — rerun metadata fields", () => {
  beforeEach(() => {
    sessionStorage.clear();
    server.use(
      http.get("*/api/auth/profile", () =>
        HttpResponse.json({ settings: { default_job_folder: "" } }),
      ),
      // Workspace.get returns 500 so the output name counts as available.
      http.post("*/api/services/workspace", async ({ request }) => {
        const body = (await request.json()) as { method?: string };
        if (body.method === "Workspace.get") {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json([]);
      }),
    );
  });

  it("submits a legacy job's metadata_fields as genome fields", async () => {
    const params = await rerunAndSubmit({
      metadata_fields: ["genome_name", "host_group", "taxon_id"],
    });

    expect(params.genome_metadata_fields).toEqual([
      "genome_name",
      "host_group",
      "taxon_id",
    ]);
    expect(params).not.toHaveProperty("feature_metadata_fields");
  });

  it("recovers genome fields an earlier submission filed as feature fields", async () => {
    const params = await rerunAndSubmit({
      genome_metadata_fields: ["genome_id", "genome_name"],
      feature_metadata_fields: ["public", "product"],
    });

    // "public" is a genome field; "product" is a gene field the table does
    // not offer, so it is dropped and the app keeps its default gene labels.
    expect(params.genome_metadata_fields).toEqual([
      "genome_id",
      "genome_name",
      "public",
    ]);
    expect(params).not.toHaveProperty("feature_metadata_fields");
  });
});
