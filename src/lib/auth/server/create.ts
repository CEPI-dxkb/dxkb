import { createAuthAdmin, type AuthAdmin } from "./admin";
import { createAuthHelpers, type AuthHelpers } from "./route";
import type { IdentityProviderPort, SessionStoragePort } from "./ports";

export interface CreateAuthPorts {
  identity: IdentityProviderPort;
  session: SessionStoragePort;
}

export interface Authority {
  auth: AuthHelpers;
  authAdmin: AuthAdmin;
}

export function createAuth(ports: CreateAuthPorts): Authority {
  const auth = createAuthHelpers(ports);
  const authAdmin = createAuthAdmin(ports);
  return { auth, authAdmin };
}
