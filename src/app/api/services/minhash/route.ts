import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  callMinhashService,
  MinhashConfigurationError,
} from "@/lib/services/minhash";

export const POST = withAuth(async (request: NextRequest, { token }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 },
    );
  }

  try {
    const answer = await callMinhashService(body, token);
    return answer.ok
      ? NextResponse.json(answer.body)
      : NextResponse.json(answer.body, { status: answer.status });
  } catch (error) {
    // The variable's name is for the server log; the client gets the
    // user-facing reason.
    if (error instanceof MinhashConfigurationError) {
      console.error(error.message);
      return NextResponse.json(
        { error: error.userMessage, code: "unknown" },
        { status: 500 },
      );
    }
    throw error;
  }
});
