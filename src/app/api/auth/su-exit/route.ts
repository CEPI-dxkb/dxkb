import { authAdmin } from "@/lib/auth/server/instance";
import { respondWithSession } from "@/lib/auth/server/respond";

export async function POST() {
  return respondWithSession(await authAdmin.exitImpersonation());
}
