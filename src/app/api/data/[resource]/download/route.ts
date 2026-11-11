import { NextRequest, NextResponse } from "next/server";
import {
  downloadFileName,
  downloadFormats,
  downloadNonceCookie,
  maxDownloadRequestBytes,
} from "@/lib/data-api/downloads";
import {
  DataApiValidationError,
  isDataResource,
} from "@/lib/data-api/resources";
import {
  dataApiErrorResponse,
  dataApiNotConfiguredMessage,
} from "@/lib/data-api/route-errors";
import {
  declaresOversizedBody,
  oversizedBodyResponse,
  rateLimitedResponse,
  readCappedBody,
} from "@/lib/data-api/route-guards";
import { resolveServerDataRepository } from "@/lib/data-api/server-policy";
import { validateDownloadRequest } from "@/lib/data-api/validation";

/**
 * Table and FASTA downloads: `POST` a `DownloadRequest` (JSON, or a form whose one `request` field holds it) and stream the upstream file as an attachment.
 * A form's errors land in a hidden iframe, so they are answered as `text/plain` to keep browsers from mounting a JSON viewer over them.
 */
const rateLimitMax = 20;
const rateLimitWindowMs = 60_000;
const formContentType = "application/x-www-form-urlencoded";

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Copies a 429's `Retry-After` into its body as `retryAfterMs`, since the iframe reading a form's error cannot see headers. */
function withRetryAfter(text: string, response: NextResponse): string {
  const header = response.headers.get("Retry-After");
  const seconds = Number(header);
  if (
    response.status !== 429 ||
    header === null ||
    !Number.isFinite(seconds) ||
    seconds < 0
  )
    return text;
  try {
    const payload: unknown = JSON.parse(text);
    if (payload && typeof payload === "object")
      return JSON.stringify({ ...payload, retryAfterMs: seconds * 1_000 });
  } catch {
    // non-JSON body: return as-is
  }
  return text;
}

async function asPlainText(response: NextResponse): Promise<NextResponse> {
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new NextResponse(withRetryAfter(await response.text(), response), {
    status: response.status,
    headers,
  });
}

function parseBody(text: string, isForm: boolean): unknown {
  if (!isForm) return JSON.parse(text);
  const field = new URLSearchParams(text).get("request");
  if (field === null)
    throw new DataApiValidationError("Request form must carry a request field.");
  return JSON.parse(field);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
): Promise<NextResponse> {
  const isForm = (request.headers.get("content-type") ?? "")
    .toLowerCase()
    .startsWith(formContentType);
  const answer = (response: NextResponse) =>
    isForm ? asPlainText(response) : response;

  const { resource } = await context.params;
  if (!isDataResource(resource)) {
    return answer(
      NextResponse.json(
        { error: `Unsupported data resource: ${resource}`, code: "not_found" },
        { status: 404 },
      ),
    );
  }
  const blocked = rateLimitedResponse(request, {
    scope: "data-download",
    bucket: resource,
    max: rateLimitMax,
    windowMs: rateLimitWindowMs,
    message: "Too many downloads. Please try again shortly.",
  });
  if (blocked) return answer(blocked);
  if (declaresOversizedBody(request, maxDownloadRequestBytes))
    return answer(oversizedBodyResponse());

  try {
    const text = await readCappedBody(request, maxDownloadRequestBytes);
    if (text === null) return await answer(oversizedBodyResponse());
    const download = validateDownloadRequest(
      resource,
      parseBody(text, isForm),
    );
    // `"query"`: an authenticated caller can see private genomes, so a download is never shared.
    const { repository } = await resolveServerDataRepository({
      readScope: "query",
      notConfigured: {
        message: dataApiNotConfiguredMessage,
        log: "Download gateway is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
      },
    });
    const body = await repository.download(resource, download, request.signal);
    const response = new NextResponse(body, {
      headers: {
        "Content-Type": downloadFormats[download.format].contentType,
        "Content-Disposition": contentDisposition(
          downloadFileName(download.fileNameBase, download.format),
        ),
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
    if (download.nonce) {
      response.cookies.set(downloadNonceCookie, download.nonce, {
        path: "/",
        maxAge: 60,
        sameSite: "strict",
        secure: request.nextUrl.protocol === "https:",
      });
    }
    return response;
  } catch (error) {
    return await answer(
      dataApiErrorResponse(
        error instanceof SyntaxError
          ? new DataApiValidationError("Request body must be valid JSON.")
          : error,
      ),
    );
  }
}
