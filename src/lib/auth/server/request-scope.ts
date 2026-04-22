import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthUser } from "@/lib/auth/types";
import type { SessionIdentity } from "./ports";

export interface RequestScope {
  sessionPromise?: Promise<SessionIdentity | null>;
  userPromise?: Promise<AuthUser | null>;
}

const storage = new AsyncLocalStorage<RequestScope>();

export function getRequestScope(): RequestScope | undefined {
  return storage.getStore();
}

export function withRequestScope<T>(
  fn: (scope: RequestScope) => Promise<T>,
): Promise<T> {
  const existing = storage.getStore();
  if (existing) return fn(existing);
  const scope: RequestScope = {};
  return storage.run(scope, () => fn(scope));
}
