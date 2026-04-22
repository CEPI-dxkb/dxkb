import { createAuth } from "./create";
import { bvbrcIdentity } from "./adapters/bvbrc-identity";
import { cookieSession } from "./adapters/cookie-session";

const authority = createAuth({
  identity: bvbrcIdentity(),
  session: cookieSession(),
});

export const auth = authority.auth;
export const authAdmin = authority.authAdmin;
export const withAuth = authority.auth.route;
