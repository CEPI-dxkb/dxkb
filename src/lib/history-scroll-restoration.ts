/**
 * Back and forward for the shells' inner scroll regions.
 *
 * The browser restores the window's scroll on back and forward, but the
 * landing and entity shells scroll a region inside the page, and Next remounts
 * a page whose search params change (`?tab=genomes`), so going back drew the
 * region afresh at the top. A region that takes `restoreHistoryScroll` as its
 * ref keeps its offset per address (path and query) and, when back or forward
 * lands on an address it was scrolled at, returns there.
 */

const offsets = new Map<string, number>();
const maxRememberedAddresses = 50;
/** The address the last back or forward step landed on. */
let traversedTo: string | undefined;
/** Back and forward steps so far, so a region can tell the address moved under it. */
let traversals = 0;
let listening = false;

/** How long a restore waits for the region's content to grow tall enough. */
const settleMs = 2000;
/** Input that means the reader is scrolling, which a restore must not fight. */
const readerInput = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

function currentAddress(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function remember(address: string, offset: number) {
  offsets.delete(address);
  offsets.set(address, offset);
  if (offsets.size > maxRememberedAddresses) {
    const oldest = offsets.keys().next().value;
    if (oldest !== undefined) offsets.delete(oldest);
  }
}

function onTraverse() {
  traversals += 1;
  traversedTo = currentAddress();
}

/**
 * Ref callback for a scroll region: records its offset as it scrolls and, on
 * a back or forward step to an address it was scrolled at, scrolls back there.
 * The content may still be growing when the region mounts (charts measure
 * themselves), which clamps the offset, so the restore tries again each frame
 * until it gets there, the reader scrolls, or two seconds pass.
 */
export function restoreHistoryScroll(region: HTMLElement | null) {
  if (!region) return;
  // The listener is added before any step back to this region's address: a
  // region has to have been scrolled there first.
  if (!listening) {
    window.addEventListener("popstate", onTraverse);
    listening = true;
  }

  let address = currentAddress();
  const traversalsAtMount = traversals;
  // Left set while it names this address, not cleared on use: Strict Mode
  // attaches a ref twice, and the second attach has to restore as well.
  if (traversedTo !== address) traversedTo = undefined;
  const target = traversedTo === undefined ? undefined : offsets.get(address);

  const save = () => {
    const now = currentAddress();
    if (now !== address) {
      // After a back or forward step the address names the entry that is
      // about to replace this region, whose offset this one must not take. (A
      // region that outlives the step, between History API entries of one
      // page, keeps its own scroll anyway.)
      if (traversals !== traversalsAtMount) return;
      // A History API write, such as a nested table's page, is still this
      // region's address.
      address = now;
    }
    remember(address, region.scrollTop);
  };
  region.addEventListener("scroll", save, { passive: true });

  let frame = 0;
  const stopRestoring = () => {
    cancelAnimationFrame(frame);
    for (const type of readerInput) {
      region.removeEventListener(type, stopRestoring);
    }
  };
  if (target) {
    const deadline = performance.now() + settleMs;
    const attempt = () => {
      region.scrollTop = target;
      if (region.scrollTop < target - 1 && performance.now() < deadline) {
        frame = requestAnimationFrame(attempt);
      } else {
        stopRestoring();
      }
    };
    for (const type of readerInput) {
      region.addEventListener(type, stopRestoring, { passive: true });
    }
    attempt();
  }

  return () => {
    stopRestoring();
    region.removeEventListener("scroll", save);
  };
}
