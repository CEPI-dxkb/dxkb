import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React from "react";

import GenomeAssemblyPage from "@/app/services/(genomics)/genome-assembly/page";
import { ServiceDebuggingProvider } from "@/contexts/service-debugging-context";
import { AuthBoundary, memoryAuthAdapter } from "@/lib/auth";
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
      //   - Workspace.get → OutputFolder name-availability check;
      //     checkWorkspaceObjectExists treats 200 as "name taken" and 500
      //     as "name available", so we must return non-OK here or the
      //     Assemble button gets disabled by the debounced check mid-test.
      http.post("*/api/services/workspace", async ({ request }) => {
        const body = (await request.json()) as { method?: string };
        if (body.method === "Workspace.get") {
          return new HttpResponse(null, { status: 500 });
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
});
