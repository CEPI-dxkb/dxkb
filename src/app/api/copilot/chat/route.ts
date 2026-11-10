import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/server/route";
import {
  answerCopilot,
  copilotBadRequest,
  readCopilotJsonBody,
} from "@/lib/copilot/route-errors";
import {
  maxCopilotAttachments,
  maxCopilotFileBytes,
  maxCopilotImageBytes,
} from "@/lib/copilot/attachments";
import {
  copilotActionsSchema,
  copilotPlanSchema,
  isCopilotId,
  maxCopilotPageContextLength,
  maxCopilotQueryLength,
  openCopilotTurn,
} from "@/lib/copilot/server";
import { copilotName } from "@/lib/copilot/name";

export const dynamic = "force-dynamic";

const answerSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(4000),
});

/** Every attachment slot as a text file at twice the file cap (base64 plus JSON-escaping), plus 2 MB for the query, page context and plan. */
const maxChatBodyBytes =
  maxCopilotAttachments * 2 * maxCopilotFileBytes + 2 * 1024 * 1024;

const attachmentName = z.string().trim().min(1).max(255);

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
    replayActions: copilotActionsSchema.optional(),
    preparedActions: copilotActionsSchema.optional(),
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
  .refine((turn) => !(turn.clarification && turn.planStep))
  .refine(
    (turn) =>
      (turn.images?.length ?? 0) +
        (turn.files?.length ?? 0) +
        (turn.pdfs?.length ?? 0) <=
      maxCopilotAttachments,
  );

/** One chat turn: the gateway's `text/event-stream` passed through; a client disconnect closes the upstream request, but the gateway still saves the turn (Stop is the explicit cancel). */
export const POST = withAuth(async (request, { token }) => {
  const body = await readCopilotJsonBody(request, maxChatBodyBytes);
  if ("error" in body) return body.error;
  const turn = chatRequestSchema.safeParse(body.value);
  if (!turn.success) return copilotBadRequest(`Invalid ${copilotName} chat request.`);

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
