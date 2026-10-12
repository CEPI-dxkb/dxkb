import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React from "react";

import PrimerDesignPage from "@/app/services/(genomics)/primer-design/page";
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

const submissions: { app_params: Record<string, unknown> }[] = [];

function rerun(job: Record<string, unknown>) {
  sessionStorage.setItem("pd-rerun", JSON.stringify(job));
  window.history.replaceState({}, "", "/?rerun_key=pd-rerun");
}

const outputs = { output_path: "/ws/testuser/out", output_file: "rerun-pd" };
const fastaPath = "/ws/testuser/gene.fna";

describe("Primer Design rerun", () => {
  beforeEach(() => {
    submissions.length = 0;
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    server.use(
      http.get("*/api/auth/profile", () =>
        HttpResponse.json({ settings: { default_job_folder: "" } }),
      ),
      // Workspace.get is the output name check: 500 means "name available".
      http.post("*/api/services/workspace", async ({ request }) => {
        const body = (await request.json()) as { method?: string };
        if (body.method === "Workspace.get")
          return new HttpResponse(null, { status: 500 });
        return HttpResponse.json([[]]);
      }),
      http.post("*/api/services/app-service/submit", async ({ request }) => {
        submissions.push(
          (await request.json()) as { app_params: Record<string, unknown> },
        );
        return HttpResponse.json({ job: [{ id: "job-1" }] });
      }),
    );
  });

  // DXKB used to send workplace_fasta; legacy and the app use workspace_fasta.
  it.each(["workspace_fasta", "workplace_fasta"])(
    "reopens a %s job as a workspace FASTA and resubmits workspace_fasta",
    async (inputType) => {
      rerun({ ...outputs, input_type: inputType, sequence_input: fastaPath });
      const user = userEvent.setup();
      render(<PrimerDesignPage />, { wrapper: Providers });

      expect(
        await screen.findByRole("radio", { name: "Workspace FASTA" }),
      ).toBeChecked();
      expect(screen.getByLabelText("FASTA File")).toHaveValue(fastaPath);

      const button = screen.getByRole("button", { name: "Submit" });
      await waitFor(() => {
        expect(button).toBeEnabled();
      });
      await user.click(button);
      await waitFor(() => {
        expect(submissions).toHaveLength(1);
      });
      expect(submissions[0]?.app_params).toMatchObject({
        input_type: "workspace_fasta",
        sequence_input: fastaPath,
      });
    },
  );
});
