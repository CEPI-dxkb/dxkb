import { z } from "zod";
import {
  describeUpstreamFailure,
  describeUpstreamResponse,
} from "@/lib/api/upstream-failure";
import { formatUserFacingErrorMessage } from "@/lib/utils";

/** Inquiry categories offered in the contact form. */
export const inquiryTypes = [
  { value: "general", label: "General Inquiry" },
  { value: "technical", label: "Technical Support" },
  { value: "research", label: "Research Collaboration" },
  { value: "feedback", label: "Feedback & Suggestions" },
] as const;

export type InquiryType = (typeof inquiryTypes)[number]["value"];

const inquiryTypeValues = inquiryTypes.map((option) => option.value) as [
  InquiryType,
  ...InquiryType[],
];

/** Validation schema shared by the client form and the /api/contact route. */
export const contactFormSchema = z.object({
  inquiryType: z.enum(inquiryTypeValues),
  name: z.string().trim().min(1, "Please enter your name."),
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address.")
    .pipe(z.email("Please enter a valid email address.")),
  subject: z.string().trim().min(1, "Please enter a subject."),
  message: z
    .string()
    .trim()
    .min(10, "Please provide a message of at least 10 characters."),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

export const defaultContactFormValues: ContactFormData = {
  inquiryType: "general",
  name: "",
  email: "",
  subject: "",
  message: "",
};

/** Human-readable label for an inquiry type value. */
export const inquiryTypeLabel = (value: InquiryType): string =>
  inquiryTypes.find((option) => option.value === value)?.label ?? value;

/**
 * How long the form waits for `/api/contact`. Without a budget a hung relay
 * left the button on "Sending..." until the browser gave up minutes later.
 * The route bounds its own SMTP wait below this (see `smtpSendDeadlineMs`), so a
 * slow relay answers with its reason before the form stops waiting.
 */
export const contactRequestTimeoutMs = 30_000;

/**
 * nodemailer's per-step SMTP budgets for `/api/contact` (its defaults are
 * 2 min to connect and 10 min of socket inactivity). They name the step that
 * stalled, but do not bound the send: `socketTimeout` is inactivity, so each
 * command may wait that long, and a relay that keeps trickling replies resets
 * it forever. `smtpSendDeadlineMs` is the bound.
 */
export const smtpTimeoutsMs = {
  connectionTimeout: 8_000,
  greetingTimeout: 8_000,
  socketTimeout: 10_000,
} as const;

/**
 * The whole send's deadline in `/api/contact`, inside
 * `contactRequestTimeoutMs` so the form hears the reason before it stops
 * waiting. At the deadline the route destroys the relay connection.
 */
export const smtpSendDeadlineMs = 25_000;

const contactService = "the contact service";

/**
 * Why `/api/contact` answered with an error: the route's own `{ error }`, or,
 * for a body that is not ours (a proxy's HTML 503), the status and the page
 * title, never its markup.
 */
export async function contactResponseError(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  try {
    const parsed: unknown = JSON.parse(body);
    const error =
      typeof parsed === "object" && parsed !== null && "error" in parsed
        ? parsed.error
        : undefined;
    if (typeof error === "string" && error.trim()) {
      return formatUserFacingErrorMessage(new Error(error), error);
    }
  } catch {
    // Not JSON: describe the status and page instead.
  }
  return describeUpstreamResponse(response, body, contactService).message;
}

/**
 * Why the request to `/api/contact` never got an answer: the spent budget
 * ("… did not respond (timed out after 30 s)") or the network failure with the
 * browser's own words ("Could not reach the contact service: Failed to fetch").
 * Every `TypeError` a browser `fetch` rejects with is a network failure, and
 * Safari's says only "Load failed", so it is named as one here too.
 */
export function contactRequestError(error: unknown): string {
  const failure = describeUpstreamFailure(error, contactService, {
    timeoutMs: contactRequestTimeoutMs,
  });
  if (failure) return failure.message;
  if (error instanceof TypeError) {
    return `Could not reach ${contactService}: ${formatUserFacingErrorMessage(error, "network error")}.`;
  }
  return formatUserFacingErrorMessage(error, "Your message could not be sent.");
}

interface MailSendError {
  code?: unknown;
  responseCode?: unknown;
}

/**
 * The route's answer when the relay refused or never answered, worded so an
 * anonymous submitter learns what went wrong without the relay's host, port
 * or reply text: nodemailer's error `code` picks the phrase, and the code (or
 * the SMTP status) stays in the message for whoever the user writes to.
 */
export function mailSendFailure(error: unknown): {
  status: number;
  message: string;
} {
  const { code, responseCode } =
    typeof error === "object" && error !== null ? (error as MailSendError) : {};
  const label =
    typeof responseCode === "number"
      ? `SMTP ${String(responseCode)}`
      : typeof code === "string"
        ? code
        : undefined;
  const suffix = label ? ` (${label})` : "";

  if (code === "ETIMEDOUT") {
    return {
      status: 504,
      message: `Could not send your message: the mail server did not respond in time${suffix}.`,
    };
  }
  if (
    code === "ECONNECTION" ||
    code === "ESOCKET" ||
    code === "EDNS" ||
    code === "ETLS" ||
    code === "EPROXY"
  ) {
    return {
      status: 502,
      message: `Could not send your message: the mail server could not be reached${suffix}.`,
    };
  }
  return {
    status: 502,
    message: `Could not send your message: the mail server rejected it${suffix}.`,
  };
}
