import { Socket } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { withErrorHandling } from "@/lib/auth/server/errors";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  contactFormSchema,
  inquiryTypeLabel,
  mailSendFailure,
  smtpSendDeadlineMs,
  smtpTimeoutsMs,
  type ContactFormData,
} from "@/app/(footer)/contact/components/contact-form-utils";

const rateLimitMax = 5;
const rateLimitWindowMs = 60 * 60 * 1000;

function buildMessageBody(data: ContactFormData): string {
  return [
    `Inquiry type: ${inquiryTypeLabel(data.inquiryType)}`,
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    "",
    data.message,
  ].join("\n");
}

/**
 * Runs `send` within `smtpSendDeadlineMs` and destroys the relay socket when the submitter leaves,
 * since nodemailer cannot cancel a send and the relay would otherwise deliver a message the user was told had failed.
 */
async function sendWithinDeadline(
  send: Promise<unknown>,
  socket: Socket,
  signal: AbortSignal,
): Promise<void> {
  const cutOff = () => {
    socket.destroy();
    // A socket destroyed while nodemailer resolves the relay's name is revived
    // by its `connect()`; drop it again once it connects.
    socket.once("connect", () => socket.destroy());
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      cutOff();
      reject(
        Object.assign(
          new Error(
            `SMTP send did not finish within ${String(smtpSendDeadlineMs / 1000)} s`,
          ),
          { code: "ETIMEDOUT" },
        ),
      );
    }, smtpSendDeadlineMs);
  });
  if (signal.aborted) cutOff();
  signal.addEventListener("abort", cutOff, { once: true });
  try {
    await Promise.race([send, deadline]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cutOff);
  }
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  const limit = rateLimit(
    `contact:${clientIp(request)}`,
    rateLimitMax,
    rateLimitWindowMs,
  );
  if (!limit.allowed) {
    const retryAfterSeconds = Math.ceil((limit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: "Too many messages sent. Please try again later.",
        code: "rate_limited",
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    );
  }

  const json: unknown = await request.json().catch(() => null);

  const parsed = contactFormSchema.safeParse(json);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0] as { message: string } | undefined;
    return NextResponse.json(
      {
        error: firstIssue?.message ?? "Invalid contact submission.",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const host = process.env.SMTP_HOST || "localhost";
  // Only default to 25 when SMTP_PORT is unset (`Number(x) || 25` would treat "0" as unset).
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 25;
  const to = process.env.CONTACT_EMAIL_TO || "help@dxkb.org";
  const from =
    process.env.CONTACT_EMAIL_FROM || "DXKB <do-not-reply@dxkb.org>";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const hasAuth = Boolean(user && pass);

  const socket = new Socket();
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    socket,
    ...smtpTimeoutsMs,
    ...(hasAuth
      ? // Authenticated relay: keep nodemailer's certificate verification so
        // credentials cannot be captured by a self-signed man-in-the-middle.
        { auth: { user, pass } }
      : // Local on-box relay: typically a self-signed cert, no credentials at risk.
        { tls: { rejectUnauthorized: false } }),
  });

  try {
    await sendWithinDeadline(
      transport.sendMail({
        to,
        from,
        replyTo: data.email,
        subject: `[${inquiryTypeLabel(data.inquiryType)}] ${data.subject}`,
        text: buildMessageBody(data),
      }),
      socket,
      request.signal,
    );
  } catch (error) {
    // Log the raw SMTP error server-side only: it leaks relay host, port and
    // auth details to an anonymous submitter.
    const detail =
      error instanceof Error ? error.message : String(error);
    console.error("Contact email send failed:", detail);
    const failure = mailSendFailure(error);
    return NextResponse.json(
      { error: failure.message, code: "email_send_failed" },
      { status: failure.status },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
});
