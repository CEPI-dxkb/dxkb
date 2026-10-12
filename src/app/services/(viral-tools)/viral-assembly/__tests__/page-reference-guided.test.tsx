import { render, screen } from "@testing-library/react";
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

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

const fastaPlaceholder = "Select a FASTA file...";

describe("Viral Assembly reference-guided strategy", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    server.use(
      http.get("*/api/auth/profile", () =>
        HttpResponse.json({ settings: { default_job_folder: "" } }),
      ),
      http.post("*/api/services/workspace", () => HttpResponse.json([[]])),
    );
  });

  it("describes the chosen IRMA module", async () => {
    const user = userEvent.setup();
    render(<ViralAssemblyPage />, { wrapper: Providers });

    expect(
      screen.getByRole("combobox", { name: "Reference Database" }),
    ).toHaveAccessibleDescription(
      "Standard influenza assembly workflow (default)",
    );

    await chooseOption(user, "Reference Database", "SARS-CoV-2 & MERS-CoV");

    expect(
      screen.getByText(
        "Coronavirus assembly workflows (SARS-CoV-2 & MERS-CoV)",
      ),
    ).toBeInTheDocument();
  });

  it("swaps the module for a GenBank reference, with no error yet", async () => {
    const user = userEvent.setup();
    render(<ViralAssemblyPage />, { wrapper: Providers });

    await chooseOption(user, "Assembly Strategy", "Reference Guided Assembly");

    expect(
      screen.queryByRole("combobox", { name: "Reference Database" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "GenBank Accession" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Accession" })).toHaveValue("");
    expect(screen.queryByPlaceholderText(fastaPlaceholder)).toBeNull();
    expect(screen.queryByText("GenBank accession is required")).toBeNull();
  });

  it("shows an invalid accession's error, and clears it once fixed", async () => {
    const user = userEvent.setup();
    render(<ViralAssemblyPage />, { wrapper: Providers });
    await chooseOption(user, "Assembly Strategy", "Reference Guided Assembly");

    const accession = screen.getByRole("textbox", { name: "Accession" });
    await user.type(accession, "NC 045512.2");
    await user.tab();

    expect(
      await screen.findByText(
        "Enter GenBank accessions such as NC_045512.2, separated by commas",
      ),
    ).toBeInTheDocument();
    expect(accession).toHaveAttribute("aria-invalid", "true");

    await user.clear(accession);
    await user.type(accession, "NC_045512.2,MN908947.3");

    expect(
      screen.queryByText(
        "Enter GenBank accessions such as NC_045512.2, separated by commas",
      ),
    ).toBeNull();
    expect(accession).not.toHaveAttribute("aria-invalid", "true");
  });

  it("offers a reference FASTA file in place of the accession", async () => {
    const user = userEvent.setup();
    render(<ViralAssemblyPage />, { wrapper: Providers });
    await chooseOption(user, "Assembly Strategy", "Reference Guided Assembly");

    await user.click(screen.getByRole("radio", { name: "Upload FASTA" }));

    expect(screen.getByPlaceholderText(fastaPlaceholder)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Accession" })).toBeNull();
    expect(screen.getByLabelText("FASTA File")).toBe(
      screen.getByPlaceholderText(fastaPlaceholder),
    );
    expect(screen.queryByText("Reference FASTA file is required")).toBeNull();
  });

  it("brings the module back when IRMA is chosen again", async () => {
    const user = userEvent.setup();
    render(<ViralAssemblyPage />, { wrapper: Providers });
    await chooseOption(user, "Assembly Strategy", "Reference Guided Assembly");
    await chooseOption(user, "Assembly Strategy", "IRMA");

    expect(
      screen.getByRole("combobox", { name: "Reference Database" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "GenBank Accession" })).toBeNull();
  });
});
