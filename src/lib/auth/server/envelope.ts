import type { AuthUser } from "@/lib/auth/types";

export interface SessionEnvelope {
  user: AuthUser | null;
  session: {
    token: string;
    expiresAt: string;
  } | null;
}

export const sessionMaxAgeMs = 3600 * 4 * 1000;

export function buildEnvelope(
  user: AuthUser | null,
  expiresAtMs: number = Date.now() + sessionMaxAgeMs,
): SessionEnvelope {
  return {
    user,
    session: user
      ? {
          token: "",
          expiresAt: new Date(expiresAtMs).toISOString(),
        }
      : null,
  };
}
