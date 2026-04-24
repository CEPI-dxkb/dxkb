import type { JsonOverride } from "../../mocks/backends";

export const mockUserProfile = {
  id: "e2e-test-user@patricbrc.org",
  email: "e2e@example.com",
  first_name: "E2E",
  last_name: "User",
  created_at: "2026-01-01T00:00:00Z",
};

export const authSessionOverrides: JsonOverride[] = [
  {
    url: "/api/auth/get-session",
    method: "GET",
    body: {
      user: mockUserProfile,
      session: { token: "e2e-test-token", expires_at: "2099-01-01T00:00:00Z" },
    },
  },
  {
    url: "/api/auth/profile",
    method: "GET",
    body: { user: mockUserProfile },
  },
  {
    url: "/api/auth/sign-in/email",
    method: "POST",
    body: {
      user: mockUserProfile,
      session: { token: "e2e-test-token", expires_at: "2099-01-01T00:00:00Z" },
    },
  },
  {
    url: "/api/auth/sign-out",
    method: "POST",
    body: { success: true },
  },
];
