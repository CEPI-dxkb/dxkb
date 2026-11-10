import { use, useEffect, useState } from "react";

/** Stand-in for a slow Next navigation: call `arm()` from the mocked `router.push` inside `<Suspense>` so the transition stays pending. */
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
