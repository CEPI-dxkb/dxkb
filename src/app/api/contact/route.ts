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

// Cap submissions per client IP to prevent flooding help@dxkb.org.
const rateLimitMax = 5;
const rateLimitWindowMs = 60 * 60 * 1000; // 1 hour

/**
 * Builds the plaintext email body from a validated contact submission,
 * mirroring the metadata the legacy /reportProblem route attached.
 */
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
 * Runs `send` within `smtpSendDeadlineMs`, and stops it when the submitter
 * leaves. nodemailer has no way to cancel a send (`close()` leaves a busy
 * connection open), so the route owns the relay socket and destroys it: the
 * relay sees the connection drop instead of delivering a message the user
 * was told had failed. The deadline rejects as nodemailer's own `ETIMEDOUT`.
 */
async function sendWithinDeadline(
  send: Promise<unknown>,
  socket: Socket,
  signal: AbortSignal,
): Promise<void> {
  const cutOff = () => {
    socket.destroy();
    // A socket destroyed while nodemailer is still resolving the relay's
    // name is revived by its `connect()`; drop it again once it connects.
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

  // Mirrors the BV-BRC report-problem route: default to the deployment
  // server's local mail relay (localhost:25, unauthenticated) unless
  // overridden by env.
  const host = process.env.SMTP_HOST || "localhost";
  // Only fall back to 25 when SMTP_PORT is unset, so an explicit value is
  // always respected (Number(x) || 25 would treat a valid "0" as unset).
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 25;
  const to = process.env.CONTACT_EMAIL_TO || "help@dxkb.org";
  const from =
    process.env.CONTACT_EMAIL_FROM || "DXKB <do-not-reply@dxkb.org>";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const hasAuth = Boolean(user && pass);

  // nodemailer connects (and TLS-upgrades) this socket; holding it is what
  // lets `sendWithinDeadline` end the send.
  const socket = new Socket();
  const transport = nodemailer.createTransport({
    host,
    port,
    // Implicit TLS on 465; STARTTLS otherwise.
    secure: port === 465,
    socket,
    // Name the stalled step; `sendWithinDeadline` bounds the whole send.
    ...smtpTimeoutsMs,
    ...(hasAuth
      ? // Authenticated (remote) relay: verify the server certificate
        // (nodemailer's default) so credentials can't be captured by a
        // man-in-the-middle presenting a self-signed cert.
        { auth: { user, pass } }
      : // Unauthenticated local relay (e.g. localhost:25): the on-box MTA
        // typically uses a self-signed cert and no credentials are at risk.
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
    // Log the raw SMTP error server-side for debugging, but don't forward it
    // to the client: nodemailer errors leak infrastructure details (relay
    // host, port, auth failure reason) to an anonymous form submitter. The
    // client gets the kind of failure and its code instead.
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
