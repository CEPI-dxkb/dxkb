import { NextRequest } from "next/server";
import { authAdmin } from "@/lib/auth/server/instance";
import { respondWithSession } from "@/lib/auth/server/respond";

/**
 * Sign up with email and password (better-auth style endpoint)
 * POST /api/auth/sign-up/email
 */
export async function POST(request: NextRequest) {
  return respondWithSession(await authAdmin.signUp(await request.json()));
}
