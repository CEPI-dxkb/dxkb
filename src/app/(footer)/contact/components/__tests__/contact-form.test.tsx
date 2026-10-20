import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";

import { server } from "@/test-helpers/msw-server";
import {
  maintenancePage,
  maintenanceSummary,
  neverRespond,
  shortenTimeouts,
} from "@/test-helpers/upstream-failures";

import ContactForm from "../contact-form";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

async function submitMessage() {
  render(<ContactForm />);
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Enter your full name"), "Ada");
  await user.type(
    screen.getByPlaceholderText("Enter your email address"),
    "ada@example.org",
  );
  await user.type(
    screen.getByPlaceholderText("Enter the subject of your message"),
    "Genome question",
  );
  await user.type(
    screen.getByPlaceholderText("Please provide details about your inquiry..."),
    "How do I annotate a genome?",
  );
  await user.click(screen.getByRole("button", { name: "Submit Message" }));
}

async function findFailure() {
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Your message was not sent");
  return alert;
}

describe("ContactForm failures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(toast.error).mockClear();
  });

  it("names the unreachable service inline and keeps the message", async () => {
    server.use(http.post("*/api/contact", () => HttpResponse.error()));

    await submitMessage();

    const alert = await findFailure();
    expect(alert).toHaveTextContent(/Could not reach the contact service: \S/);
    expect(
      screen.getByPlaceholderText("Please provide details about your inquiry..."),
    ).toHaveValue("How do I annotate a genome?");
    expect(screen.getByRole("button", { name: "Submit Message" })).toBeEnabled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("describes a proxy's HTML 503 by status and page title, never markup", async () => {
    server.use(http.post("*/api/contact", () => maintenancePage()));

    await submitMessage();

    const alert = await findFailure();
    expect(alert).toHaveTextContent(
      `The contact service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`,
    );
    expect(alert).not.toHaveTextContent("Request failed with status");
    expect(alert).not.toHaveTextContent("<");
  });

  it("shows the route's own reason", async () => {
    const reason =
      "Could not send your message: the mail server could not be reached (ECONNECTION).";
    server.use(
      http.post("*/api/contact", () =>
        HttpResponse.json(
          { error: reason, code: "email_send_failed" },
          { status: 502 },
        ),
      ),
    );

    await submitMessage();

    expect(await findFailure()).toHaveTextContent(reason);
  });

  it("stops waiting after 30 s and says so", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    shortenTimeouts();
    server.use(http.post("*/api/contact", neverRespond));

    await submitMessage();

    expect(await findFailure()).toHaveTextContent(
      "The contact service did not respond (timed out after 30 s).",
    );
    expect(timeout).toHaveBeenCalledWith(30_000);
    expect(screen.getByRole("button", { name: "Submit Message" })).toBeEnabled();
  });

  it("clears the failure when a retry succeeds", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/contact", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: "Too many messages sent." }, { status: 429 })
          : HttpResponse.json({ ok: true }, { status: 201 });
      }),
    );

    await submitMessage();
    await findFailure();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Submit Message" }));

    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
