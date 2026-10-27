import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React from "react";

import GenomeAssemblyPage from "@/app/services/(genomics)/genome-assembly/page";
import { ServiceDebuggingProvider } from "@/contexts/service-debugging-context";
import { AuthBoundary } from "@/lib/auth/provider";
import { server } from "@/test-helpers/msw-server";
import { workspaceObjectNotFound } from "@/test-helpers/workspace-responses";
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

describe("GenomeAssembly page — rerun + submit flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    server.use(
      http.get("*/api/auth/profile", () =>
        HttpResponse.json({ settings: { default_job_folder: "" } }),
      ),
      // Workspace calls used by this page:
      //   - Workspace.ls  → WorkspaceObjectSelector listing (return [])
      //   - Workspace.get → OutputFolder name-availability check; answer
      //     "Object not found" so the name is available, or the Assemble
      //     button gets disabled by the debounced check mid-test.
      http.post("*/api/services/workspace", async ({ request }) => {
        const body = (await request.json()) as { method?: string };
        if (body.method === "Workspace.get") {
          return workspaceObjectNotFound();
        }
        return HttpResponse.json([]);
      }),
    );
  });

  it("pre-fills form from rerun_key, then submits transformed params", async () => {
    sessionStorage.setItem(
      "abc123",
      JSON.stringify({
        output_path: "/ws/testuser/out",
        output_file: "my-assembly",
        recipe: "unicycler",
        paired_end_libs: [
          {
            read1: "/ws/testuser/sample_R1.fq",
            read2: "/ws/testuser/sample_R2.fq",
            platform: "illumina",
            interleaved: false,
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

    render(<GenomeAssemblyPage />, { wrapper: Providers });

    await waitFor(() => {
      expect(screen.getByDisplayValue("my-assembly")).toBeInTheDocument();
    });

    // Selected Libraries table shows the paired lib
    // Page renders both mobile + desktop variants, so we expect multiple matches.
    await waitFor(() => {
      expect(screen.getAllByText(/sample_R1\.fq/).length).toBeGreaterThan(0);
    });

    // Click Assemble to submit — wait for tanstack-form validation to mark the
    // form submittable (button is disabled until canSubmit flips to true).
    const assembleButton = screen.getByRole("button", { name: /assemble/i });
    await waitFor(() => expect(assembleButton).toBeEnabled());
    await userEvent.click(assembleButton);

    await waitFor(() => {
      expect(submittedBody).not.toBeNull();
    });

    const body = submittedBody as { app_name: string; app_params: Record<string, unknown> };
    expect(body.app_name).toBe("GenomeAssembly2");
    expect(body.app_params).toMatchObject({
      output_path: "/ws/testuser/out",
      output_file: "my-assembly",
      recipe: "unicycler",
    });
    expect(Array.isArray(body.app_params.paired_end_libs)).toBe(true);
  });

  it("restores the job's advanced options, genome size included", async () => {
    sessionStorage.setItem(
      "adv123",
      JSON.stringify({
        output_path: "/ws/testuser/out",
        output_file: "my-assembly",
        recipe: "canu",
        single_end_libs: [{ read: "/ws/testuser/long.fq", platform: "nanopore" }],
        genome_size: 4600000,
        target_depth: "300",
        trim: "false",
        normalize: false,
        filtlong: true,
        racon_iter: 3,
        pilon_iter: 1,
        min_contig_len: 500,
        min_contig_cov: 10,
      }),
    );
    window.history.replaceState({}, "", "/?rerun_key=adv123");

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

    // 4,600,000 bases is not whole megabases, so the field shows kilobases.
    expect(
      screen.getByRole("textbox", { name: "Estimated Genome Size" }),
    ).toHaveValue("4600");
    expect(
      screen.getByRole("combobox", { name: "Genome size unit" }),
    ).toHaveTextContent("K");
    expect(
      screen.getByRole("textbox", { name: "Target Genome Coverage" }),
    ).toHaveValue("300");
    expect(screen.getByRole("switch", { name: "Trim Short Reads" })).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Normalize Illumina Reads" }),
    ).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Filter Long Reads" })).toBeChecked();

    const assembleButton = screen.getByRole("button", { name: /assemble/i });
    await waitFor(() => expect(assembleButton).toBeEnabled());
    await user.click(assembleButton);
    await waitFor(() => {
      expect(submittedBody).not.toBeNull();
    });
    expect(
      (submittedBody as { app_params: Record<string, unknown> }).app_params,
    ).toMatchObject({
      recipe: "canu",
      genome_size: 4600000,
      target_depth: 300,
      trim: false,
      normalize: false,
      filtlong: true,
      racon_iter: 3,
      pilon_iter: 1,
      min_contig_len: 500,
      min_contig_cov: 10,
    });
  });

  it("resubmits a genome size that is not whole kilobases unchanged", async () => {
    sessionStorage.setItem(
      "size123",
      JSON.stringify({
        output_path: "/ws/testuser/out",
        output_file: "my-assembly",
        recipe: "canu",
        single_end_libs: [{ read: "/ws/testuser/long.fq", platform: "nanopore" }],
        genome_size: 4641652,
      }),
    );
    window.history.replaceState({}, "", "/?rerun_key=size123");

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

    // The field shows the nearest whole kilobase; the job's exact size is
    // what gets submitted until the user edits the field.
    expect(
      screen.getByRole("textbox", { name: "Estimated Genome Size" }),
    ).toHaveValue("4642");

    const assembleButton = screen.getByRole("button", { name: /assemble/i });
    await waitFor(() => expect(assembleButton).toBeEnabled());
    await user.click(assembleButton);
    await waitFor(() => {
      expect(submittedBody).not.toBeNull();
    });
    expect(
      (submittedBody as { app_params: Record<string, unknown> }).app_params,
    ).toMatchObject({ genome_size: 4641652 });
  });
});
