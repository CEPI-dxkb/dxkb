import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better Auth catch-all route handler.
 * Handles all /api/auth/* requests for session management.
 *
 * Custom BV-BRC authentication routes (sign in, sign up, etc.)
 * are handled separately in their own route files.
 */
export const { POST, GET } = toNextJsHandler(auth);
