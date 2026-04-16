import type { AuthUser } from "@/lib/auth/types";

export interface AuthEventMap {
  "session:acquired": {
    user: AuthUser;
    via: "signIn" | "signUp" | "impersonate" | "exit-impersonate";
  };
  "session:refreshed": { user: AuthUser };
  "session:lost": { reason: SessionLostReason };
}

export type SessionLostReason =
  | "user"
  | "expired"
  | "refresh-failed"
  | "impersonation-exit";

export type AuthEventName = keyof AuthEventMap;

export type AuthEventHandler<E extends AuthEventName> = (
  payload: AuthEventMap[E],
) => void;

export interface AuthEventBus {
  on<E extends AuthEventName>(
    event: E,
    handler: AuthEventHandler<E>,
  ): () => void;
  emit<E extends AuthEventName>(event: E, payload: AuthEventMap[E]): void;
}

export function createAuthEventBus(): AuthEventBus {
  const handlers = new Map<AuthEventName, Set<AuthEventHandler<AuthEventName>>>();

  return {
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler as AuthEventHandler<AuthEventName>);
      return () => {
        set?.delete(handler as AuthEventHandler<AuthEventName>);
      };
    },
    emit(event, payload) {
      const set = handlers.get(event);
      if (!set) return;
      for (const handler of set) {
        try {
          (handler as AuthEventHandler<typeof event>)(payload);
        } catch (err) {
          console.error(`auth event handler "${String(event)}" threw:`, err);
        }
      }
    },
  };
}
