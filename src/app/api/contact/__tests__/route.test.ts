import nodemailer from "nodemailer";

import { json, mockNextRequest } from "@/test-helpers/api-route-helpers";

import { POST } from "../route";

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn() },
}));

const submission = {
  inquiryType: "technical",
  name: "Ada",
  email: "ada@example.org",
  subject: "Genome question",
  message: "How do I annotate a genome?",
};

let clientNumber = 0;

/** Each request comes from its own address, so the hourly limit never trips. */
function contactRequest() {
  clientNumber += 1;
  return mockNextRequest({
    method: "POST",
    url: "http://localhost:3019/api/contact",
    body: submission,
    headers: { "x-forwarded-for": `203.0.113.${String(clientNumber)}` },
  });
}

function relayFails(error: Error) {
  const sendMail = vi.fn().mockRejectedValue(error);
  vi.mocked(nodemailer.createTransport).mockReturnValue({
    sendMail,
  } as unknown as ReturnType<typeof nodemailer.createTransport>);
  return sendMail;
}

function smtpError(message: string, fields: Record<string, unknown>): Error {
  return Object.assign(new Error(message), fields);
}

describe("POST /api/contact", () => {
  it("says the relay could not be reached, without its host or port", async () => {
    relayFails(
      smtpError("connect ECONNREFUSED 10.0.0.5:2525", { code: "ECONNECTION" }),
    );

    const response = await POST(contactRequest(), {});
    const body = await json(response);

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error:
        "Could not send your message: the mail server could not be reached (ECONNECTION).",
      code: "email_send_failed",
    });
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });

  it("answers 504 when the relay times out", async () => {
    relayFails(smtpError("Greeting never received", { code: "ETIMEDOUT" }));

    const response = await POST(contactRequest(), {});

    expect(response.status).toBe(504);
    expect(await json(response)).toMatchObject({
      error:
        "Could not send your message: the mail server did not respond in time (ETIMEDOUT).",
    });
  });

  it("keeps the SMTP status of a rejected message, not the relay's reply", async () => {
    relayFails(
      smtpError("Can't send mail - all recipients were rejected: 550 relay.internal denied", {
        code: "EENVELOPE",
        responseCode: 550,
      }),
    );

    const response = await POST(contactRequest(), {});
    const body = await json(response);

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      error: "Could not send your message: the mail server rejected it (SMTP 550).",
    });
    expect(JSON.stringify(body)).not.toContain("relay.internal");
  });

  it("bounds the SMTP wait inside the form's 30 s budget", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    const response = await POST(contactRequest(), {});

    expect(response.status).toBe(201);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 8_000,
        greetingTimeout: 8_000,
        socketTimeout: 10_000,
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "ada@example.org" }),
    );
  });
});
