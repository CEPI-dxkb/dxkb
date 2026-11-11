/** Restores the shells' inner scroll regions on back/forward, keyed per address (path and query). */

const offsets = new Map<string, number>();
const maxRememberedAddresses = 50;
let traversedTo: string | undefined;
/** The offset at that address when the step was taken, until a region attaches there. */
let offsetAtStep: { offset: number | undefined } | undefined;
/** Regions attached before any step named their address; the popstate listener runs before React renders, so a cached destination attaches first. */
const attachedThisTask = new Set<() => void>();
let listening = false;

const settleMs = 2000;
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
  // A push is a new entry and starts at the top, even at the address back last landed on.
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

/** Ref callback for a scroll region: records its offset and restores it on back/forward, retrying each frame while content grows. */
export function restoreHistoryScroll(region: HTMLElement | null) {
  if (!region) return;
  if (!listening) {
    listen();
    listening = true;
  }

  const address = currentAddress();
  // Set during a restore: clamped intermediate steps must not overwrite the remembered target offset.
  let restoring = false;

  const save = () => {
    if (restoring) return;
    // Record under the page's current address; a step being replaced records under the destination's, which its region undoes.
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
      // Out of time the region stops moving but the restore stays open until the reader takes over.
    };
    for (const type of readerInput) {
      region.addEventListener(type, stopRestoring, { passive: true });
    }
    attempt();
  };
  const stepTarget = () => {
    if (traversedTo !== address) return undefined;
    if (offsetAtStep) {
      // The first region at the step's address: what the page being left recorded there is not this address's offset.
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

  // Left set rather than cleared on use, because Strict Mode attaches a ref twice.
  if (traversedTo !== address) forgetTraversal();
  const target = stepTarget();
  if (target) {
    restore(target);
  } else if (traversedTo === undefined) {
    // The timer runs after the dispatching task, so a region outliving a later step is left alone.
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
