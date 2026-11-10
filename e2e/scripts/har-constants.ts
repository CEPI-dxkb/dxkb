/**
 * Stable placeholder the recorder rewrites the recorded host to, so specs on
 * any E2E_PORT match. Its own module so importing it does not trigger the
 * recorder's `main()`.
 */
export const harReplayHostPlaceholder = "http://e2e-har-replay.local";

/**
 * Realm-qualified user id baked into the recorded HARs; HAR-replay specs must
 * navigate to it so workspace calls hit the recorded entries.
 */
export const recordedTestUserId = "e2e-test-user@bvbrc";
