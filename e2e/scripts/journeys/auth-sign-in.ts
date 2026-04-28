import type { JourneyDriver } from "../record-har";
import { signIn } from "./_helpers/sign-in";

/**
 * Captures the bare sign-in surface: `/api/auth/sign-in/email` plus whatever
 * `/api/auth/get-session` and downstream profile fetches fire during the
 * post-auth `networkidle` settle. `auth.spec.ts` replays this HAR to verify
 * the spec's mock matches the live BV-BRC response shape.
 */
export const drive: JourneyDriver = signIn;
