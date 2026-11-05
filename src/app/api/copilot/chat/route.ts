import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/server/route";
import {
  answerCopilot,
  copilotBadRequest,
} from "@/lib/copilot/route-errors";
import {
  maxCopilotAttachments,
  maxCopilotFileBytes,
  maxCopilotImageBytes,
} from "@/lib/copilot/attachments";
import {
  copilotPlanSchema,
  isCopilotId,
  maxCopilotPageContextLength,
  maxCopilotQueryLength,
  openCopilotTurn,
} from "@/lib/copilot/server";

export const dynamic = "force-dynamic";

const answerSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(4000),
});

/**
 * Prepared actions go back to the gateway verbatim, which checks them against
 * the card it stored; here they are only bounded.
 */
const actionsSchema = z
  .array(z.looseObject({ tool: z.string().min(1).max(100) }))
  .min(1)
  .max(50)
  .refine((actions) => JSON.stringify(actions).length <= 200_000);

const attachmentName = z.string().trim().min(1).max(255);

/** Base64 is 4/3 of the bytes it carries, plus the `data:…;base64,` prefix. */
function dataUrlLimit(bytes: number): number {
  return Math.ceil((bytes * 4) / 3) + 100;
}

const imageSchema = z.object({
  name: attachmentName,
  dataUrl: z
    .string()
    .max(dataUrlLimit(maxCopilotImageBytes))
    .regex(/^data:image\/[a-z0-9.+-]+;base64,/),
});

const fileSchema = z.object({
  name: attachmentName,
  content: z
    .string()
    .max(maxCopilotFileBytes)
    .refine((content) => !content.includes("\0")),
  mimeType: z.string().max(100),
  size: z.number().int().min(0),
});

const pdfSchema = z.object({
  name: attachmentName,
  // "%PDF-" in base64 starts "JVBERi0".
  dataUrl: z
    .string()
    .max(dataUrlLimit(maxCopilotFileBytes))
    .regex(/^data:application\/pdf;base64,JVBERi0/),
  size: z.number().int().min(0),
});

const chatRequestSchema = z
  .object({
    sessionId: z.string().refine(isCopilotId),
    query: z.string().trim().min(1).max(maxCopilotQueryLength),
    model: z.string().trim().min(1).max(200),
    pageContext: z.string().max(maxCopilotPageContextLength).optional(),
    executionMode: z.enum(["plan", "execute"]).optional(),
    targetAgent: z
      .string()
      .regex(/^[a-z_]{1,40}$/)
      .optional(),
    clarification: z
      .object({
        answers: z.array(answerSchema).min(1).max(20),
        originalQuery: z.string().max(maxCopilotQueryLength),
      })
      .optional(),
    replayActions: actionsSchema.optional(),
    preparedActions: actionsSchema.optional(),
    planStep: z
      .object({
        plan: copilotPlanSchema,
        stepIndex: z.number().int().min(0).max(29),
      })
      .optional(),
    images: z.array(imageSchema).max(maxCopilotAttachments).optional(),
    files: z.array(fileSchema).max(maxCopilotAttachments).optional(),
    pdfs: z.array(pdfSchema).max(maxCopilotAttachments).optional(),
  })
  .refine((turn) => !(turn.replayActions && turn.preparedActions))
  .refine(
    (turn) =>
      (turn.images?.length ?? 0) +
        (turn.files?.length ?? 0) +
        (turn.pdfs?.length ?? 0) <=
      maxCopilotAttachments,
  );

/**
 * One chat turn: the gateway's `text/event-stream`, passed through as it
 * arrives. Only the whitelisted fields reach the gateway (`copilotTurnBody`),
 * which takes the user from the token. A client that disconnects closes the upstream request; the
 * gateway still finishes and saves the turn (Stop is the explicit cancel).
 */
export const POST = withAuth(async (request, { token }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return copilotBadRequest("Malformed JSON");
  }
  const turn = chatRequestSchema.safeParse(body);
  if (!turn.success) return copilotBadRequest("Invalid Copilot chat request.");

  return answerCopilot(async () => {
    const upstream = await openCopilotTurn(token, turn.data, request.signal);
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-cache, no-transform",
        Connection: "keep-alive",
        // Tells an nginx in front of this app not to buffer the stream.
        "X-Accel-Buffering": "no",
      },
    });
  });
});
