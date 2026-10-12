import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

/** Why a check rejected a pick. */
export interface PickRejection {
  /** A short line: the toast's title, and the field's error. */
  title: string;
  /** The full text: the toast's description, and the field's error details. */
  message: string;
}

/**
 * A workspace pick that is not in the form: its check still running, or the
 * check rejected it. The selector shows `path`, so the form never holds a
 * pick other than the one on screen.
 */
export type PickCheck =
  | { status: "validating"; path: string }
  | { status: "rejected"; path: string; rejection: PickRejection };

interface PickCheckRun {
  /** The check: null when the pick passes. */
  check: () => Promise<PickRejection | null>;
  /** Puts the pick in the form. */
  onPass: () => void;
  /** Leaves it out, validating the field so it shows and blocks Submit. */
  onReject: () => void;
}

/**
 * Runs the check of a workspace pick that may enter the form only once it
 * passes (legacy MSA's genome group and FASTA file checks). Only the latest
 * pick's result lands: a newer pick, `cancel`, or leaving the page drops an
 * older one. A rejection's toast stays until it is closed, until the pick
 * changes and the error no longer applies, or until the page is left.
 */
export function usePickCheck() {
  const [state, setState] = useState<PickCheck | null>(null);
  const latest = useRef(0);
  const toastId = useId();

  // The Toaster outlives the page, so a check still running when it unmounts
  // would call the old form's handlers and raise a toast that never closes.
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
