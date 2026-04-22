import { renderHook } from "@testing-library/react";
import { useAuthStyles } from "@/hooks/use-auth-styles";

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { isAuthenticated: false, status: "guest" as "loading" | "authed" | "guest" },
}));
vi.mock("@/lib/auth/hooks", () => ({
  useAuth: () => mockAuth,
}));
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.flat().filter(Boolean).join(" "),
}));

function setAuth(isAuthenticated: boolean, isLoading: boolean) {
  Object.assign(mockAuth, {
    isAuthenticated,
    status: isLoading ? "loading" : isAuthenticated ? "authed" : "guest",
  });
}

describe("useAuthStyles", () => {
  beforeEach(() => {
    setAuth(false, false);
  });

  describe("authClass", () => {
    it("returns authenticatedClass when authenticated", () => {
      setAuth(true, false);
      const { result } = renderHook(() => useAuthStyles());

      expect(result.current.authClass("auth-yes", "auth-no")).toBe("auth-yes");
    });

    it("returns unauthenticatedClass when not authenticated", () => {
      setAuth(false, false);
      const { result } = renderHook(() => useAuthStyles());

      expect(result.current.authClass("auth-yes", "auth-no")).toBe("auth-no");
    });
  });

  describe("whenAuthenticated", () => {
    it("returns the class when authenticated", () => {
      setAuth(true, false);
      const { result } = renderHook(() => useAuthStyles());

      expect(result.current.whenAuthenticated("visible")).toBe("visible");
    });

    it("returns empty string when not authenticated", () => {
      setAuth(false, false);
      const { result } = renderHook(() => useAuthStyles());

      expect(result.current.whenAuthenticated("visible")).toBe("");
    });
  });

  describe("whenUnauthenticated", () => {
    it("returns the class when not authenticated", () => {
      setAuth(false, false);
      const { result } = renderHook(() => useAuthStyles());

      expect(result.current.whenUnauthenticated("hidden")).toBe("hidden");
    });

    it("returns empty string when authenticated", () => {
      setAuth(true, false);
      const { result } = renderHook(() => useAuthStyles());

      expect(result.current.whenUnauthenticated("hidden")).toBe("");
    });
  });

  describe("whenLoading", () => {
    it("returns the class when loading", () => {
      setAuth(false, true);
      const { result } = renderHook(() => useAuthStyles());

      expect(result.current.whenLoading("spinner")).toBe("spinner");
    });

    it("returns empty string when not loading", () => {
      setAuth(false, false);
      const { result } = renderHook(() => useAuthStyles());

      expect(result.current.whenLoading("spinner")).toBe("");
    });
  });

  describe("authClasses", () => {
    it("combines classes where condition is true", () => {
      setAuth(true, false);
      const { result } = renderHook(() => useAuthStyles());

      const classes = result.current.authClasses({
        "text-green": true,
        "bg-red": false,
        "font-bold": true,
      });

      expect(classes).toContain("text-green");
      expect(classes).toContain("font-bold");
      expect(classes).not.toContain("bg-red");
    });

    it("returns empty string when all conditions are false", () => {
      setAuth(false, false);
      const { result } = renderHook(() => useAuthStyles());

      const classes = result.current.authClasses({
        "hidden-class": false,
        "other-class": false,
      });

      expect(classes).toBe("");
    });
  });
});
