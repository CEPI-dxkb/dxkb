import { useSyncExternalStore } from "react";
import { noop } from "@/lib/utils";

const emptySubscribe = () => noop;

export function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
