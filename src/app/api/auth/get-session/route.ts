import { authAdmin, respondWithSession } from "@/lib/auth/server";

export async function GET() {
  return respondWithSession(await authAdmin.currentSession());
}
