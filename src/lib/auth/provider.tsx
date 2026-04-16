"use client";

import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { httpAuthAdapter } from "@/lib/auth/adapters/http";
import type { AuthPort } from "@/lib/auth/port";
import {
  createAuthStore,
  getActiveAuthStore,
  setActiveAuthStore,
  type AuthStore,
} from "@/lib/auth/store";
import { isProtectedPagePath } from "@/lib/auth/routes";
import type { AuthUser } from "@/lib/auth/types";

const AuthStoreContext = createContext<AuthStore | null>(null);

export function useAuthStore(): AuthStore {
  const store = useContext(AuthStoreContext);
  if (!store) {
    throw new Error(
      "useAuth / useSignIn must be used within <AuthBoundary>",
    );
  }
  return store;
}

export interface AuthBoundaryProps {
  children: ReactNode;
  initialUser?: AuthUser | null;
  port?: AuthPort;
}

export function AuthBoundary({
  children,
  initialUser = null,
  port,
}: AuthBoundaryProps) {
  const [store] = useState<AuthStore>(() =>
    createAuthStore({
      port: port ?? httpAuthAdapter(),
      initialUser,
    }),
  );

  const hydratedRef = useRef(false);

  useEffect(() => {
    setActiveAuthStore(store);
    return () => {
      if (getActiveAuthStore() === store) setActiveAuthStore(null);
    };
  }, [store]);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void store.refresh();
  }, [store]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (store.snapshot().status !== "authed") return;
      void store.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [store]);

  return (
    <AuthStoreContext.Provider value={store}>
      <Suspense fallback={children}>
        <ProtectedRouteGuard store={store}>{children}</ProtectedRouteGuard>
      </Suspense>
    </AuthStoreContext.Provider>
  );
}

function ProtectedRouteGuard({
  store,
  children,
}: {
  store: AuthStore;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const check = () => {
      const { user, status } = store.snapshot();
      if (status === "loading") return;
      if (user) return;
      if (!isProtectedPagePath(pathname)) return;
      const query = searchParams.toString();
      const fullPath = query ? `${pathname}?${query}` : pathname;
      router.replace(`/sign-in?redirect=${encodeURIComponent(fullPath)}`);
    };
    check();
    return store.subscribe(check);
  }, [store, router, pathname, searchParams]);

  return children;
}
