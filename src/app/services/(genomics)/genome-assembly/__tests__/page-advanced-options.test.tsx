import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React from "react";

import GenomeAssemblyPage from "@/app/services/(genomics)/genome-assembly/page";
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

// BV-BRC's Assembly2 form shows Estimated Genome Size under Advanced ›
// Genome Parameters for every assembly strategy, not only Canu.
describe("GenomeAssembly page — advanced options", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    server.use(
      http.get("*/api/auth/profile", () =>
        HttpResponse.json({ settings: { default_job_folder: "" } }),
      ),
      // Workspace.get 500 reads as "output name available" (see page-rerun).
      http.post("*/api/services/workspace", async ({ request }) => {
        const body = (await request.json()) as { method?: string };
        if (body.method === "Workspace.get") {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json([]);
      }),
    );
  });

  it("sits in Advanced Options for the default strategy and submits its size in bases", async () => {
    sessionStorage.setItem(
      "abc123",
      JSON.stringify({
        output_path: "/ws/testuser/out",
        output_file: "my-assembly",
        recipe: "auto",
        paired_end_libs: [
          {
            read1: "/ws/testuser/sample_R1.fq",
            read2: "/ws/testuser/sample_R2.fq",
          },
        ],
      }),
    );
    window.history.replaceState({}, "", "/?rerun_key=abc123");
    let submittedBody: unknown = null;
    server.use(
      http.post("*/api/services/app-service/submit", async ({ request }) => {
        submittedBody = await request.json();
        return HttpResponse.json({ job: [{ id: "job-xyz" }] });
      }),
    );
    const user = userEvent.setup();

    render(<GenomeAssemblyPage />, { wrapper: Providers });
    await waitFor(() => {
      expect(screen.getByDisplayValue("my-assembly")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Advanced Options/ }));
    const genomeSize = screen.getByRole("textbox", {
      name: "Estimated Genome Size",
    });
    expect(genomeSize).toHaveValue("5");
    expect(
      screen.getByRole("combobox", { name: "Genome size unit" }),
    ).toHaveTextContent("M");

    await user.clear(genomeSize);
    await user.type(genomeSize, "7");

    const assembleButton = screen.getByRole("button", { name: /assemble/i });
    await waitFor(() => expect(assembleButton).toBeEnabled());
    await user.click(assembleButton);
    await waitFor(() => {
      expect(submittedBody).not.toBeNull();
    });
    expect(
      (submittedBody as { app_params: Record<string, unknown> }).app_params,
    ).toMatchObject({ recipe: "auto", genome_size: 7000000 });
  });

  it("groups the options into BV-BRC's four titled sections, each with its info popup", async () => {
    const user = userEvent.setup();
    render(<GenomeAssemblyPage />, { wrapper: Providers });
    await user.click(screen.getByRole("button", { name: /Advanced Options/ }));

    const sections = [
      ["Read Processing", "switch", ["Normalize Illumina Reads", "Trim Short Reads", "Filter Long Reads"]],
      ["Genome Parameters", "textbox", ["Estimated Genome Size", "Target Genome Coverage"]],
      ["Assembly Polishing", "textbox", ["Racon Iterations", "Pilon Iterations"]],
      ["Assembly Thresholds", "textbox", ["Min. contig length", "Min. contig coverage"]],
    ] as const;
    for (const [title, role, fields] of sections) {
      const group = screen.getByRole("group", { name: title });
      // Only its own fields: no control landed in the wrong section.
      expect(within(group).getAllByRole(role)).toHaveLength(fields.length);
      for (const name of fields) {
        expect(within(group).getByRole(role, { name })).toBeInTheDocument();
      }
      expect(
        within(group).getByRole("button", { name: `More info: ${title}` }),
      ).toBeInTheDocument();
    }
  });
});
