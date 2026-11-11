import { z } from "zod";
import {
  describeUpstreamFailure,
  describeUpstreamResponse,
} from "@/lib/api/upstream-failure";
import { formatUserFacingErrorMessage } from "@/lib/utils";

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

export const inquiryTypeLabel = (value: InquiryType): string =>
  inquiryTypes.find((option) => option.value === value)?.label ?? value;

/**
 * Budget for `/api/contact`; the route's SMTP deadline (`smtpSendDeadlineMs`)
 * sits below it so the reason arrives first.
 */
export const contactRequestTimeoutMs = 30_000;

/**
 * Per-step nodemailer budgets; `socketTimeout` is inactivity, not a bound on
 * the send, so `smtpSendDeadlineMs` is the bound.
 */
export const smtpTimeoutsMs = {
  connectionTimeout: 8_000,
  greetingTimeout: 8_000,
  socketTimeout: 10_000,
} as const;

/**
 * Whole-send deadline, below `contactRequestTimeoutMs`; the route destroys the
 * relay connection when it passes.
 */
export const smtpSendDeadlineMs = 25_000;

const contactService = "the contact service";

/**
 * Falls back to the status and page title (never markup) for a non-JSON body
 * such as a proxy's 503.
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
    // non-JSON body: fall through
  }
  return describeUpstreamResponse(response, body, contactService).message;
}

/**
 * Safari's network failure says only "Load failed", so every `TypeError` from
 * `fetch` is named as one.
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
 * Worded without the relay's host, port or reply text; the code or SMTP status
 * stays in the message.
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
