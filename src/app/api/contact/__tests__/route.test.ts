import { Socket } from "node:net";
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
function contactRequest(signal?: AbortSignal) {
  clientNumber += 1;
  return mockNextRequest({
    method: "POST",
    url: "http://localhost:3019/api/contact",
    body: submission,
    headers: { "x-forwarded-for": `203.0.113.${String(clientNumber)}` },
    signal,
  });
}

/** The socket the route handed nodemailer for this send. */
function relaySocket(): Socket {
  const options = vi.mocked(nodemailer.createTransport).mock.lastCall?.[0] as
    | { socket?: unknown }
    | undefined;
  if (!(options?.socket instanceof Socket)) {
    throw new Error("The route did not hand nodemailer a socket.");
  }
  return options.socket;
}

/**
 * A relay that never finishes the send, as nodemailer behaves with one: the
 * send ends only when its socket closes, with "Connection closed unexpectedly".
 */
function relayHangs() {
  const sendMail = vi.fn(
    () =>
      new Promise((_, reject) => {
        relaySocket().once("close", () => {
          reject(
            smtpError("Connection closed unexpectedly", { code: "ECONNECTION" }),
          );
        });
      }),
  );
  vi.mocked(nodemailer.createTransport).mockReturnValue({
    sendMail,
  } as unknown as ReturnType<typeof nodemailer.createTransport>);
  return sendMail;
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

  it("ends a send that outlasts its deadline, inside the form's 30 s budget", async () => {
    vi.useFakeTimers();
    try {
      const sendMail = relayHangs();

      const pending = POST(contactRequest(), {});
      await vi.advanceTimersByTimeAsync(24_999);
      expect(relaySocket().destroyed).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const response = await pending;

      expect(response.status).toBe(504);
      expect(await json(response)).toEqual({
        error:
          "Could not send your message: the mail server did not respond in time (ETIMEDOUT).",
        code: "email_send_failed",
      });
      expect(relaySocket().destroyed).toBe(true);
      await expect(sendMail.mock.results[0]?.value).rejects.toThrow(
        "Connection closed unexpectedly",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops the relay connection when the submitter goes away", async () => {
    const sendMail = relayHangs();
    const controller = new AbortController();

    const pending = POST(contactRequest(controller.signal), {});
    await vi.waitFor(() => {
      expect(sendMail).toHaveBeenCalled();
    });
    controller.abort();
    const response = await pending;

    expect(relaySocket().destroyed).toBe(true);
    expect(response.status).toBe(502);
  });

  it("bounds each SMTP step and sends through the route's own socket", async () => {
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
    expect(relaySocket()).toBeInstanceOf(Socket);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "ada@example.org" }),
    );
  });
});
