/**
 * Waits 20 ms of real time, so a background refresh the last call started has
 * reached MSW before a test asserts that no request was sent. Needs a real
 * `setTimeout`: fake only `Date` (`vi.useFakeTimers({ toFake: ["Date"] })`).
 */
export function settleBackgroundWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}
