import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/auth/server/instance";
import { respondWithSession } from "@/lib/auth/server/respond";

export async function POST(request: NextRequest) {
  let body: { targetUser?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400 },
    );
  }
  return respondWithSession(
    await authAdmin.impersonate(body.targetUser ?? "", body.password ?? ""),
  );
}
