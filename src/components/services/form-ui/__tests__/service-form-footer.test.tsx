import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "@tanstack/react-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { ServiceFormFooter } from "@/components/services/form-ui/service-form-footer";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { server } from "@/test-helpers/msw-server";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

type FooterProps = Partial<Parameters<typeof ServiceFormFooter>[0]>;

function Harness(props: FooterProps) {
  const form = useForm({ defaultValues: { name: "" } });
  return (
    <ServiceFormFooter
      form={form}
      onReset={vi.fn()}
      isSubmitting={false}
      submitDisabled={false}
      {...props}
    />
  );
}

function renderFooter(props: FooterProps = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

describe("ServiceFormFooter", () => {
  it("renders the Reset/Submit row with the shared class", () => {
    const { container } = renderFooter({ className: "md:col-span-2" });
    const row = container.querySelector(".service-form-controls");
    expect(row).toHaveClass("md:col-span-2");
    expect(screen.getByRole("button", { name: "Reset" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(screen.getByRole("button", { name: "Submit" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("calls onReset when Reset is clicked", async () => {
    const onReset = vi.fn();
    renderFooter({ onReset });
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("disables Submit when submitDisabled is set", () => {
    renderFooter({ submitDisabled: true });
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("shows the spinner and disables Submit while submitting", () => {
    renderFooter({ isSubmitting: true, spinnerClassName: "mr-2 size-4" });
    expect(screen.getByRole("button", { name: /Submit/ })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Loading" })).toHaveClass(
      "mr-2",
    );
  });

  it("shows no spinner when idle", () => {
    renderFooter();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("uses a custom submit label", () => {
    renderFooter({ submitLabel: "Assemble" });
    expect(
      screen.getByRole("button", { name: "Assemble" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();
  });

  it("shows the failed submission above the row", async () => {
    server.use(
      http.post("*/api/services/app-service/submit", () =>
        HttpResponse.json(
          { error: "JSON-RPC call failed: fetch failed", code: "upstream" },
          { status: 502 },
        ),
      ),
    );
    function SubmittingForm() {
      const { submit, isSubmitting } = useServiceFormSubmission({
        serviceName: "BLAST",
        displayName: "BLAST",
      });
      const form = useForm({
        defaultValues: { name: "" },
        onSubmit: () => submit({}),
      });
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <ServiceFormFooter
            form={form}
            onReset={() => {
              form.reset();
            }}
            isSubmitting={isSubmitting}
            submitDisabled={false}
          />
        </form>
      );
    }
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { mutations: { retry: false } },
          })
        }
      >
        <SubmittingForm />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("JSON-RPC call failed: fetch failed");
  });
});
