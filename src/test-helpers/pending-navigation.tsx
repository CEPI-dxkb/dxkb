import { use, useEffect, useState } from "react";

/**
 * A stand-in for a slow Next navigation. Render `Suspender` anywhere in the
 * tree and have the mocked `router.push` call `arm()`: when that runs inside a
 * transition, `Suspender` suspends forever, so the transition (and the
 * component's `useTransition` pending flag) stays pending, which jsdom's
 * instant `push` mock never does on its own.
 */
export function createPendingNavigation() {
  const neverSettles = new Promise<never>(() => undefined);
  const armRef: { current: (() => void) | null } = { current: null };

  function Suspender() {
    const [armed, setArmed] = useState(false);
    useEffect(() => {
      armRef.current = () => {
        setArmed(true);
      };
    }, []);
    if (armed) use(neverSettles);
    return null;
  }

  return {
    Suspender,
    arm: () => {
      armRef.current?.();
    },
  };
}
