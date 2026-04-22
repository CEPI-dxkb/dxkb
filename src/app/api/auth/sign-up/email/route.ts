import { NextRequest } from "next/server";
import { authAdmin } from "@/lib/auth/server/instance";
import { withErrorHandling } from "@/lib/auth/server/errors";
import { respondWithSession } from "@/lib/auth/server/respond";

export const POST = withErrorHandling(async (request: NextRequest) => {
  return respondWithSession(await authAdmin.signUp(await request.json()));
});
