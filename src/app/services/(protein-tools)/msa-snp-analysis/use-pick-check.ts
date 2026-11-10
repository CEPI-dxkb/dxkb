import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

export interface PickRejection {
  title: string;
  message: string;
}

export type PickCheck =
  | { status: "validating"; path: string }
  | { status: "rejected"; path: string; rejection: PickRejection };

interface PickCheckRun {
  check: () => Promise<PickRejection | null>;
  onPass: () => void;
  onReject: () => void;
}

/** Only the latest pick's result lands; a newer pick, `cancel`, or leaving the page drops an older one. */
export function usePickCheck() {
  const [state, setState] = useState<PickCheck | null>(null);
  const latest = useRef(0);
  const toastId = useId();

  // The Toaster outlives the page, so a check running at unmount must not call old form handlers or raise a toast.
  useEffect(() => {
    return () => {
      latest.current += 1;
      toast.dismiss(toastId);
    };
  }, [toastId]);

  function cancel() {
    latest.current += 1;
    toast.dismiss(toastId);
    setState(null);
  }

  async function start(path: string, { check, onPass, onReject }: PickCheckRun) {
    const request = ++latest.current;
    toast.dismiss(toastId);
    setState({ status: "validating", path });
    const rejection = await check();
    if (request !== latest.current) return;

    if (!rejection) {
      // The form first: the selector shows `state.path` until it holds the pick.
      onPass();
      setState(null);
      return;
    }
    toast.error(rejection.title, {
      id: toastId,
      description: rejection.message,
      closeButton: true,
      duration: Infinity,
    });
    setState({ status: "rejected", path, rejection });
    onReject();
  }

  return {
    state,
    isValidating: state?.status === "validating",
    rejection: state?.status === "rejected" ? state.rejection : null,
    start,
    cancel,
  };
}
