import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React from "react";

import ViralAssemblyPage from "@/app/services/(viral-tools)/viral-assembly/page";
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
  sessionStorage.setItem("va-rerun", JSON.stringify(job));
  window.history.replaceState({}, "", "/?rerun_key=va-rerun");
}

const outputs = { output_path: "/ws/testuser/out", output_file: "rerun-va" };
const pairedReads = {
  read1: "/ws/testuser/a_R1.fq",
  read2: "/ws/testuser/a_R2.fq",
};

async function submit(user: ReturnType<typeof userEvent.setup>) {
  const button = screen.getByRole("button", { name: /assemble/i });
  await waitFor(() => {
    expect(button).toBeEnabled();
  });
  await user.click(button);
  await waitFor(() => {
    expect(submissions).toHaveLength(1);
  });
  return submissions[0]?.app_params;
}

describe("Viral Assembly rerun", () => {
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
      http.get("*/api/services/sra-validation", () =>
        HttpResponse.json({ timeout: true }),
      ),
      http.post("*/api/services/app-service/submit", async ({ request }) => {
        submissions.push(
          (await request.json()) as { app_params: Record<string, unknown> },
        );
        return HttpResponse.json({ job: [{ id: "job-1" }] });
      }),
    );
  });

  it("reopens a GenBank reference and resubmits it with commas", async () => {
    rerun({
      ...outputs,
      paired_end_lib: pairedReads,
      strategy: "reference_guided",
      reference_type: "genbank",
      reference_genbank_accession: "NC_045512.2;MN908947.3",
    });
    const user = userEvent.setup();
    render(<ViralAssemblyPage />, { wrapper: Providers });

    const accession = await screen.findByRole("textbox", { name: "Accession" });
    expect(accession).toHaveValue("NC_045512.2;MN908947.3");
    expect(screen.getByRole("radio", { name: "GenBank Accession" })).toBeChecked();
    expect(
      screen.queryByRole("combobox", { name: "Reference Database" }),
    ).toBeNull();

    expect(await submit(user)).toEqual({
      strategy: "reference_guided",
      reference_type: "genbank",
      reference_genbank_accession: "NC_045512.2,MN908947.3",
      ...outputs,
      paired_end_lib: pairedReads,
    });
  });

  it("reopens a FASTA reference from legacy's strategy value", async () => {
    rerun({
      ...outputs,
      paired_end_lib: pairedReads,
      strategy: "reference-guided",
      reference_type: "fasta",
      reference_fasta_file: "/ws/testuser/ref.fasta",
    });
    const user = userEvent.setup();
    render(<ViralAssemblyPage />, { wrapper: Providers });

    expect(
      await screen.findByRole("radio", { name: "Upload FASTA" }),
    ).toBeChecked();

    const params = await submit(user);
    expect(params).toMatchObject({
      strategy: "reference_guided",
      reference_type: "fasta",
      reference_fasta_file: "/ws/testuser/ref.fasta",
    });
    expect(params).not.toHaveProperty("module");
  });

  it("opens an auto reference on GenBank, empty and with no error", async () => {
    rerun({
      ...outputs,
      paired_end_lib: pairedReads,
      strategy: "reference_guided",
      reference_type: "auto",
      reference_genome_id: "11060.9352",
    });
    render(<ViralAssemblyPage />, { wrapper: Providers });

    const accession = await screen.findByRole("textbox", { name: "Accession" });
    expect(accession).toHaveValue("");
    expect(accession).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("GenBank accession is required")).toBeNull();
  });

  it("reopens an IRMA job with its module", async () => {
    rerun({
      ...outputs,
      paired_end_lib: pairedReads,
      strategy: "irma",
      module: "RSV",
    });
    const user = userEvent.setup();
    render(<ViralAssemblyPage />, { wrapper: Providers });

    expect(
      await screen.findByText("Respiratory Syncytial Virus assembly (A & B groups)"),
    ).toBeInTheDocument();
    expect(await submit(user)).toMatchObject({ strategy: "irma", module: "RSV" });
  });

  it("reopens legacy's sra_id and resubmits it as sra_id", async () => {
    rerun({ ...outputs, strategy: "irma", module: "FLU", sra_id: "SRR123456" });
    const user = userEvent.setup();
    render(<ViralAssemblyPage />, { wrapper: Providers });

    expect(
      await screen.findByRole("radio", { name: "SRA Run Accession" }),
    ).toBeChecked();
    const params = await submit(user);
    expect(params).toMatchObject({ sra_id: "SRR123456" });
    expect(params).not.toHaveProperty("srr_id");
  });

  it("submits IRMA after a bad accession was left behind", async () => {
    rerun({ ...outputs, paired_end_lib: pairedReads, strategy: "irma" });
    const user = userEvent.setup();
    render(<ViralAssemblyPage />, { wrapper: Providers });
    await screen.findByDisplayValue("rerun-va");

    await user.click(screen.getByRole("combobox", { name: "Assembly Strategy" }));
    await user.click(
      await screen.findByRole("option", { name: "Reference Guided Assembly" }),
    );
    await user.type(screen.getByRole("textbox", { name: "Accession" }), "bad");
    expect(
      await screen.findByText(/^Enter GenBank accessions/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Assembly Strategy" }));
    await user.click(await screen.findByRole("option", { name: "IRMA" }));

    const params = await submit(user);
    expect(params).toMatchObject({ strategy: "irma", module: "FLU" });
    expect(params).not.toHaveProperty("reference_type");
  });
});
