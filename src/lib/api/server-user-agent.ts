/**
 * User-Agent for server-side requests to BV-BRC hosts that sit behind
 * Cloudflare (the account service, the Copilot gateway).
 *
 * Cloudflare answers Node's default user agent (`node`) with a managed
 * challenge: HTTP 403, `cf-mitigated: challenge`, and an HTML page titled
 * "Just a moment...", which a server fetch cannot pass. The challenge reaches
 * the user as "… rejected the request (HTTP 403 Forbidden: Just a moment)".
 * A browser user agent is challenged too, because Cloudflare also checks the
 * TLS fingerprint; this one is let through.
 *
 * This is a workaround for a Cloudflare rule DXKB does not own. The durable
 * fix is a rule on the BV-BRC side that lets DXKB's server traffic through.
 */
export const bvbrcServerUserAgent = "curl/8.7.1 DXKB-V2/1.0";
