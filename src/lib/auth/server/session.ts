import { cookies } from "next/headers";
import { safeDecode } from "@/lib/url";
import type { SessionIdentity } from "@/lib/auth/types";
import {
  sessionCookieNames,
  sessionMaxAgeMs,
  suBackupCookieNames,
} from "./cookies";

const vestigialUserProfileCookieName = "bvbrc_user_profile";
const sessionMaxAgeSeconds = sessionMaxAgeMs / 1000;
const secureCookies =
  process.env.AUTH_COOKIE_SECURE === undefined
    ? process.env.NODE_ENV === "production"
    : process.env.AUTH_COOKIE_SECURE === "true";
const cookieOptions = {
  httpOnly: true,
  secure: secureCookies,
  sameSite: "strict" as const,
  path: "/",
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieNames = typeof sessionCookieNames | typeof suBackupCookieNames;

function readIdentity(
  store: CookieStore,
  names: CookieNames,
): SessionIdentity | null {
  const encodedToken = store.get(names.token)?.value;
  const token = encodedToken ? safeDecode(encodedToken) : undefined;
  const userId = store.get(names.userId)?.value;
  const realm = store.get(names.realm)?.value;
  if (!token || !userId) return null;
  return { token, userId, realm: realm || undefined };
}

function clearIdentity(store: CookieStore, names: CookieNames): void {
  for (const name of Object.values(names)) {
    try {
      store.set(name, "", { ...cookieOptions, maxAge: 0 });
    } catch (cause) {
      console.error("Failed to clear session cookie", { name, cause });
    }
  }
}

function writeIdentity(
  store: CookieStore,
  names: CookieNames,
  identity: SessionIdentity,
): number {
  const expiresAt = Date.now() + sessionMaxAgeMs;
  const options = {
    ...cookieOptions,
    maxAge: sessionMaxAgeSeconds,
    expires: new Date(expiresAt),
  };
  store.set(names.token, identity.token, options);
  store.set(names.userId, identity.userId, options);
  if (identity.realm) store.set(names.realm, identity.realm, options);
  else store.set(names.realm, "", { ...cookieOptions, maxAge: 0 });
  return expiresAt;
}

export async function readSession(): Promise<SessionIdentity | null> {
  return readIdentity(await cookies(), sessionCookieNames);
}

export async function writeSession(identity: SessionIdentity): Promise<number> {
  return writeIdentity(await cookies(), sessionCookieNames, identity);
}

export async function clearCurrentSession(): Promise<void> {
  const store = await cookies();
  clearIdentity(store, sessionCookieNames);
  try {
    store.set(vestigialUserProfileCookieName, "", {
      ...cookieOptions,
      maxAge: 0,
    });
  } catch (cause) {
    console.error("Failed to clear session cookie", {
      name: vestigialUserProfileCookieName,
      cause,
    });
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  clearIdentity(store, sessionCookieNames);
  clearIdentity(store, suBackupCookieNames);
  try {
    store.set(vestigialUserProfileCookieName, "", {
      ...cookieOptions,
      maxAge: 0,
    });
  } catch (cause) {
    console.error("Failed to clear session cookie", {
      name: vestigialUserProfileCookieName,
      cause,
    });
  }
}

export async function readImpersonationBackup(): Promise<SessionIdentity | null> {
  return readIdentity(await cookies(), suBackupCookieNames);
}

export async function writeImpersonationBackup(
  identity: SessionIdentity,
): Promise<number> {
  return writeIdentity(await cookies(), suBackupCookieNames, identity);
}

export async function clearImpersonationBackup(): Promise<void> {
  clearIdentity(await cookies(), suBackupCookieNames);
}

export async function restoreImpersonationBackup(): Promise<number | null> {
  const store = await cookies();
  const backup = readIdentity(store, suBackupCookieNames);
  if (!backup) return null;
  const expiresAt = writeIdentity(store, sessionCookieNames, backup);
  clearIdentity(store, suBackupCookieNames);
  return expiresAt;
}
