import { cookies } from "next/headers";
import { safeDecode } from "@/lib/url";
import {
  sessionCookieNames,
  suBackupCookieNames,
} from "../middleware";
import type { SessionStoragePort, SessionIdentity } from "../ports";

export { sessionCookieNames, suBackupCookieNames };

const vestigialUserProfileCookieName = "bvbrc_user_profile";

const sessionMaxAgeSeconds = 3600 * 4;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function setCookie(
  store: CookieStore,
  name: string,
  value: string,
  maxAgeSeconds: number,
): void {
  store.set(name, value, { ...cookieOptions, maxAge: maxAgeSeconds });
}

function clearCookie(store: CookieStore, name: string): void {
  store.set(name, "", { ...cookieOptions, maxAge: 0 });
}

function readIdentity(
  store: CookieStore,
  names: { token: string; userId: string; realm: string },
): SessionIdentity | null {
  const raw = store.get(names.token)?.value;
  const token = raw ? safeDecode(raw) : undefined;
  const userId = store.get(names.userId)?.value;
  const realm = store.get(names.realm)?.value;
  if (!token || !userId) return null;
  return {
    token,
    userId,
    realm: realm || undefined,
    expiresAt: Date.now() + sessionMaxAgeSeconds * 1000,
  };
}

function writeIdentity(
  store: CookieStore,
  names: { token: string; userId: string; realm: string },
  identity: SessionIdentity,
): void {
  setCookie(store, names.token, identity.token, sessionMaxAgeSeconds);
  setCookie(store, names.userId, identity.userId, sessionMaxAgeSeconds);
  if (identity.realm) {
    setCookie(store, names.realm, identity.realm, sessionMaxAgeSeconds);
  } else {
    clearCookie(store, names.realm);
  }
}

export function cookieSession(): SessionStoragePort {
  return {
    async read() {
      const store = await cookies();
      return readIdentity(store, sessionCookieNames);
    },

    async write(identity) {
      const store = await cookies();
      writeIdentity(store, sessionCookieNames, identity);
    },

    async clear() {
      const store = await cookies();
      // Order matches the existing deleteSession() in src/lib/auth/session.ts to
      // preserve test-observable call order during the Phase 1 transition.
      clearCookie(store, sessionCookieNames.token);
      clearCookie(store, sessionCookieNames.realm);
      clearCookie(store, vestigialUserProfileCookieName);
      clearCookie(store, sessionCookieNames.userId);
      clearCookie(store, suBackupCookieNames.token);
      clearCookie(store, suBackupCookieNames.userId);
      clearCookie(store, suBackupCookieNames.realm);
    },

    async readBackup() {
      const store = await cookies();
      return readIdentity(store, suBackupCookieNames);
    },

    async writeBackup(identity) {
      const store = await cookies();
      writeIdentity(store, suBackupCookieNames, identity);
    },

    async clearBackup() {
      const store = await cookies();
      clearCookie(store, suBackupCookieNames.token);
      clearCookie(store, suBackupCookieNames.userId);
      clearCookie(store, suBackupCookieNames.realm);
    },
  };
}
