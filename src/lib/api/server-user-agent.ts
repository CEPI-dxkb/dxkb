/**
 * User-Agent for server requests to BV-BRC hosts behind Cloudflare (account service, Copilot gateway).
 * Cloudflare answers Node's default user agent with a managed 403 challenge ("Just a moment...") a server fetch cannot pass, and a browser user agent is challenged too because of TLS fingerprinting. This is a workaround for a Cloudflare rule DXKB does not own.
 */
export const bvbrcServerUserAgent = "curl/8.7.1 DXKB-V2/1.0";
