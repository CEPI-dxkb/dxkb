import { authAdmin } from "@/lib/auth/server/instance";
import { respondWithSession } from "@/lib/auth/server/respond";

export async function GET() {
  return respondWithSession(await authAdmin.currentSession());
}
