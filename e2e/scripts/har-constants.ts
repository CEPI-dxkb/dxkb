/**
 * Recorded HARs reference the host the recorder was driven against (e.g.
 * `http://127.0.0.1:3010`) but specs run against a different port (E2E_PORT,
 * default 3020). The recorder rewrites the recorded host to this stable
 * placeholder; `applyBackendMocks` swaps it back to the active host before
 * passing the HAR to `page.routeFromHAR`. Kept in its own module so importing
 * it from specs does not trigger the recorder's `main()` entry point.
 */
export const HAR_REPLAY_HOST_PLACEHOLDER = "http://e2e-har-replay.local";
