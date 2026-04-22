import type { NextRequest } from "next/server";

export const sessionCookieNames = {
  token: "bvbrc_token",
  userId: "bvbrc_user_id",
  realm: "bvbrc_realm",
} as const;

export const suBackupCookieNames = {
  token: "bvbrc_su_original_token",
  userId: "bvbrc_su_original_user_id",
  realm: "bvbrc_su_original_realm",
} as const;

export function hasSession(request: NextRequest): boolean {
  const token = request.cookies.get(sessionCookieNames.token)?.value;
  const userId = request.cookies.get(sessionCookieNames.userId)?.value;
  return Boolean(token && userId);
}
