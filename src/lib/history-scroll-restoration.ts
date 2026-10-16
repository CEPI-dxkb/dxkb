/**
 * Back and forward for the shells' inner scroll regions.
 *
 * The browser restores the window's scroll on back and forward, but the
 * landing and entity shells scroll a region inside the page. Only a scrolling
 * view has that region (a table view fills the page instead), so a tab change
 * takes it away and a new path remounts the page: going back drew the region
 * afresh at the top. A region that takes `restoreHistoryScroll` as its ref
 * keeps its offset per address (path and query) and, when back or forward
 * lands on an address it was scrolled at, returns there.
 */

const offsets = new Map<string, number>();
const maxRememberedAddresses = 50;
/** The address the last back or forward step landed on, until a link opens a new entry. */
let traversedTo: string | undefined;
/**
 * That address's offset when the step was taken, until a region attaches there.
 * The page being left can stay on screen until the destination renders, and
 * its region records under the destination's address meanwhile.
 */
let offsetAtStep: { offset: number | undefined } | undefined;
/**
 * Regions attached in this task before any step named their address, each
 * with a callback that restores it if the step being dispatched lands there.
 * The router's popstate listener runs first when it was added first (Chromium
 * keeps a window's listeners in that order, capture or not), and React renders
 * a step's update in the microtask after it: a cached destination attaches
 * its region before `onTraverse` hears of the step.
 */
const attachedThisTask = new Set<() => void>();
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
  traversedTo = currentAddress();
  offsetAtStep = { offset: offsets.get(traversedTo) };
  for (const arrive of attachedThisTask) arrive();
  attachedThisTask.clear();
}

function forgetTraversal() {
  traversedTo = undefined;
  offsetAtStep = undefined;
}

function listen() {
  window.addEventListener("popstate", onTraverse);
  // A push is a new entry, which starts at the top even at the address back
  // last landed on. Next's router pushes every link (and replaces on every
  // commit, a step's own included), and nested tables push their pages.
  const pushState = window.history.pushState.bind(window.history);
  window.history.pushState = (
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ) => {
    forgetTraversal();
    attachedThisTask.clear();
    pushState(data, unused, url);
  };
}

/**
 * Ref callback for a scroll region: records its offset as it scrolls and, on
 * a back or forward step to an address it was scrolled at, scrolls back there.
 * The content may still be growing when the region mounts (charts measure
 * themselves), which clamps the offset, so the restore tries again each frame
 * until it gets there, the reader scrolls, or two seconds pass. Its clamped
 * steps are not the reader's, so they leave the remembered offset alone.
 */
export function restoreHistoryScroll(region: HTMLElement | null) {
  if (!region) return;
  // Listening starts before any step back to this region's address: a region
  // has to have been scrolled there first.
  if (!listening) {
    listen();
    listening = true;
  }

  const address = currentAddress();
  // Set while a restore is under way. Its steps scroll the region short of the
  // target while the content grows, and saving one would remember that clamped
  // offset in the target's place. The restore ends when the region gets there
  // (a step's scroll event that arrives late then saves the target) or the
  // reader takes over. Running out of time does not end it: the reader has not
  // scrolled anywhere else, so the target is still where they left.
  let restoring = false;

  const save = () => {
    if (restoring) return;
    // Under the address the page has now. A History API write, such as a
    // nested table's page, is still this region's, and so is a back or forward
    // step it outlives. One the step is replacing records under the
    // destination until it goes, which the destination's region undoes.
    remember(currentAddress(), region.scrollTop);
  };
  region.addEventListener("scroll", save, { passive: true });

  let frame = 0;
  const stopRestoring = () => {
    restoring = false;
    cancelAnimationFrame(frame);
    for (const type of readerInput) {
      region.removeEventListener(type, stopRestoring);
    }
  };
  const restore = (target: number) => {
    restoring = true;
    const deadline = performance.now() + settleMs;
    const attempt = () => {
      region.scrollTop = target;
      if (region.scrollTop >= target - 1) {
        stopRestoring();
      } else if (performance.now() < deadline) {
        frame = requestAnimationFrame(attempt);
      }
      // Out of time, the region stops moving but the restore stays open, its
      // reader-input listeners with it, until the reader takes over.
    };
    for (const type of readerInput) {
      region.addEventListener(type, stopRestoring, { passive: true });
    }
    attempt();
  };
  /** Where the region was when back or forward last landed here, if it did. */
  const stepTarget = () => {
    if (traversedTo !== address) return undefined;
    if (offsetAtStep) {
      // The first region at the step's address: what the page being left
      // recorded here since the step was not this address's offset.
      if (offsetAtStep.offset === undefined) offsets.delete(address);
      else remember(address, offsetAtStep.offset);
      offsetAtStep = undefined;
    }
    return offsets.get(address);
  };
  const arriveLate = () => {
    const target = stepTarget();
    if (target) restore(target);
  };

  // Left set while it names this address, not cleared on use: Strict Mode
  // attaches a ref twice, and the second attach has to restore as well.
  if (traversedTo !== address) forgetTraversal();
  const target = stepTarget();
  if (target) {
    restore(target);
  } else if (traversedTo === undefined) {
    // The step may still be on its way. The timer runs after the task that
    // dispatches it, so a region that outlives a later step is left alone.
    attachedThisTask.add(arriveLate);
    setTimeout(() => {
      attachedThisTask.delete(arriveLate);
    }, 0);
  }

  return () => {
    attachedThisTask.delete(arriveLate);
    stopRestoring();
    region.removeEventListener("scroll", save);
  };
}
