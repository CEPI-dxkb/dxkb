"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import {
  closeRerunWindow,
  rerunJob,
  rerunPopupBlockedMessage,
  reserveRerunWindow,
} from "@/lib/rerun-utility";

/** Which ID kind the selection resolved to, and so which services accept it. */
export type SelectionServiceKind = "genome" | "feature";

interface SelectionServiceChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plural label of the collection the selection came from, e.g. "Strains". */
  label: string;
  ids: readonly string[];
  /** Genome IDs by default; Feature collections resolve `feature_id`s instead. */
  kind?: SelectionServiceKind;
  workspaceUsername?: string;
  /**
   * Where a signed-out user goes to sign in, opened in a new tab so this tab — and
   * with it the row selection behind the dialog — stays mounted.
   */
  signInHref: string;
  /**
   * False for collections no service accepts yet. Matches the Taxa Tree chooser:
   * the dialog still opens, it just reports that there is nothing to run.
   */
  hasSelectableServices?: boolean;
}

type ServiceChoice =
  | "blast"
  | "viral-tree"
  | "viral-msa"
  | "feature-blast"
  | "feature-blast-query"
  | "feature-blast-database"
  | "gene-tree"
  | "ha-subtype";

interface ServiceOption {
  choice: ServiceChoice;
  label: string;
  pendingLabel: string;
}

const genomeServiceOptions: readonly ServiceOption[] = [
  {
    choice: "blast",
    label: "BLAST",
    pendingLabel: "Opening BLAST...",
  },
  {
    choice: "viral-tree",
    label: "Viral Genome Tree",
    pendingLabel: "Opening Viral Genome Tree...",
  },
  {
    choice: "viral-msa",
    label: "Viral MSA",
    pendingLabel: "Opening Viral MSA...",
  },
];

const featureServiceOptions: readonly ServiceOption[] = [
  {
    choice: "feature-blast",
    label: "BLAST",
    pendingLabel: "Opening BLAST...",
  },
  {
    choice: "gene-tree",
    label: "Gene Tree",
    pendingLabel: "Opening Gene Tree...",
  },
  {
    choice: "ha-subtype",
    label: "HA Subtype Numbering Conversion",
    pendingLabel: "Opening HA Subtype Numbering Conversion...",
  },
];

/**
 * BLAST can take a Feature Group either way, so legacy asks which side of the
 * search the selection belongs on before it opens the form.
 */
const featureBlastSourceOptions: readonly ServiceOption[] = [
  {
    choice: "feature-blast-query",
    label: "Query",
    pendingLabel: "Opening BLAST...",
  },
  {
    choice: "feature-blast-database",
    label: "Source",
    pendingLabel: "Opening BLAST...",
  },
];

/** The choices that need a temporary workspace group before they can launch. */
type GroupBackedChoice = Exclude<ServiceChoice, "blast" | "feature-blast">;

/**
 * Sign-in is reported here rather than by navigating to the service form: leaving
 * the collection discards the row selection, and the form then opens unprefilled.
 */
const signInRequiredMessage =
  "Sign in to use this service. Your selection is kept here — sign in, then come back to this tab and try again.";

/**
 * Fallback for a non-`Error` rejection, and for an `Error` whose message is
 * empty or whitespace-only: `failure` is an object, so the render guard below
 * would still paint a bordered destructive `role="alert"` around no text at all
 * — announced to a screen reader as an empty alert.
 */
const genericServiceErrorMessage = "Unable to open the selected service";

/** Why the last attempt failed, and whether signing in is what unblocks it. */
interface ServiceFailure {
  message: string;
  needsSignIn?: boolean;
}

/** The rerun payload and service ID each group-backed choice launches with. */
function groupServiceLaunch(
  service: GroupBackedChoice,
  groupPath: string,
): { parameters: Record<string, unknown>; serviceId: string } {
  switch (service) {
    case "viral-tree":
      return {
        parameters: {
          tree_type: "viral_genome",
          sequences: [{ type: "genome_group", filename: groupPath }],
        },
        serviceId: "GeneTree",
      };
    case "viral-msa":
      return {
        parameters: {
          input_status: "unaligned",
          input_type: "input_genomegroup",
          select_genomegroup: [groupPath],
          ref_type: "none",
          aligner: "Mafft",
          fasta_keyboard_input: "",
          alphabet: "dna",
          ref_string: "",
        },
        serviceId: "MSA",
      };
    case "feature-blast-query":
      return {
        parameters: {
          blast_program: "blastn",
          db_type: "fna",
          input_source: "feature_group",
          input_feature_group: groupPath,
          db_precomputed_database: "bacteria-archaea",
        },
        serviceId: "Homology",
      };
    case "feature-blast-database":
      return {
        parameters: {
          blast_program: "blastn",
          db_type: "fna",
          db_precomputed_database: "selFeatureGroup",
          db_feature_group: groupPath,
        },
        serviceId: "Homology",
      };
    case "gene-tree":
      return {
        parameters: {
          tree_type: "gene",
          sequences: [{ type: "feature_group", filename: groupPath }],
        },
        serviceId: "GeneTree",
      };
    case "ha-subtype":
      return {
        parameters: {
          input_source: "feature_group",
          input_feature_group: groupPath,
        },
        serviceId: "HASubtypeNumberingConversion",
      };
  }
}

export function SelectionServiceChooser({
  open,
  onOpenChange,
  label,
  ids,
  kind = "genome",
  workspaceUsername,
  signInHref,
  hasSelectableServices = true,
}: SelectionServiceChooserProps) {
  const repository = useWorkspaceRepository("authenticated");
  const router = useRouter();
  const [pendingService, setPendingService] = useState<ServiceChoice | null>(
    null,
  );
  const [isChoosingBlastSource, setIsChoosingBlastSource] = useState(false);
  const [failure, setFailure] = useState<ServiceFailure | null>(null);
  const [lastOpen, setLastOpen] = useState(open);
  /**
   * Identifies the current dialog session so a launch that resolves after the dialog
   * was closed cannot open a service, report an error, or close a later session.
   */
  const sessionRef = useRef(0);
  useEffect(() => {
    // Every open/close transition — including one driven by the parent — ends the
    // previous session, so any launch still in flight is no longer current.
    sessionRef.current += 1;
  }, [open]);

  // Each opening starts on the service list, with no subflow or error left over.
  if (lastOpen !== open) {
    setLastOpen(open);
    setPendingService(null);
    setIsChoosingBlastSource(false);
    setFailure(null);
  }

  const needsSignIn = failure?.needsSignIn === true;
  // The refreshed session answers the prompt, so it must not linger — and clearing
  // it is what releases the focus listener below.
  if (needsSignIn && workspaceUsername) setFailure(null);

  useEffect(() => {
    if (!needsSignIn) return;
    // The session is a cookie, so signing in on another tab is invisible to this one
    // until its Server Components run again. `router.refresh()` re-derives the user
    // without remounting any client component, which is what lets the selection
    // behind this dialog survive until the retry.
    const refreshSession = () => {
      router.refresh();
    };
    window.addEventListener("focus", refreshSession);
    return () => {
      window.removeEventListener("focus", refreshSession);
    };
  }, [needsSignIn, router]);

  // Takes the username as an argument so the signed-in check stays at the one call
  // site that can act on it, rather than throwing a message with no Sign In button.
  const createTemporaryGroup = async (username: string) => {
    const directoryPath = `/${username}/home/._tmp_groups`;
    const groupName = `tmp_${kind}_group_${crypto.randomUUID()}`;
    // Nothing provisions this hidden folder at first workspace access and the group
    // write does not create parents, so create it here. An existing directory is the
    // only expected failure; all other errors must reach the chooser unchanged.
    try {
      await repository.createFolder(directoryPath);
    } catch (folderError) {
      if (
        !(folderError instanceof Error) ||
        !/\balready exists\b/i.test(folderError.message)
      ) {
        throw folderError;
      }
    }
    await repository.createIdGroup({
      path: directoryPath,
      name: groupName,
      ...(kind === "feature"
        ? { type: "feature_group" as const, idField: "feature_id" as const }
        : { type: "genome_group" as const, idField: "genome_id" as const }),
      ids: [...ids],
    });
    return `${directoryPath}/${groupName}`;
  };

  const reportServiceError = (serviceError: unknown) => {
    setFailure({
      message: formatUserFacingErrorMessage(
        serviceError,
        genericServiceErrorMessage,
      ),
    });
  };

  const runService = async ({ choice: service }: ServiceOption) => {
    const session = sessionRef.current;
    // Direct BLAST carries the selected IDs in its rerun payload and writes no
    // workspace object, so it runs signed out too: the protected service route
    // redirects through sign-in with `rerun_key` intact.
    if (service === "blast") {
      setFailure(null);
      try {
        const launch = rerunJob(
          {
            blast_program: "blastn",
            db_type: "fna",
            db_source: "genome_list",
            db_precomputed_database: "selGenome",
            db_genome_list: [...ids],
          },
          "Homology",
        );
        if (launch.status !== "opened") {
          setFailure({ message: launch.message });
          return;
        }
        onOpenChange(false);
      } catch (serviceError) {
        reportServiceError(serviceError);
      }
      return;
    }
    // Every remaining service writes a temporary workspace group first, so the
    // authentication decision comes before any further choice. The dialog stays
    // open on the current collection, which is what keeps the selection alive for
    // a retry — navigating to the service form would discard it.
    if (!workspaceUsername) {
      setFailure({ message: signInRequiredMessage, needsSignIn: true });
      return;
    }
    if (service === "feature-blast") {
      setFailure(null);
      setIsChoosingBlastSource(true);
      return;
    }
    setFailure(null);
    // Reserve the tab inside this click, before the first `await`: a pop-up blocker
    // rejects `window.open` once the gesture's task has finished. Failing here also
    // means the group is never written, so nothing is left orphaned behind it.
    const resultWindow = reserveRerunWindow();
    if (!resultWindow) {
      setFailure({ message: rerunPopupBlockedMessage });
      return;
    }
    setPendingService(service);
    let groupPath: string | undefined;
    const deleteTemporaryGroup = async () => {
      if (!groupPath) return;
      try {
        await repository.delete([groupPath]);
      } catch {
        // Cleanup must not replace the launch failure shown to the user.
      }
    };
    try {
      groupPath = await createTemporaryGroup(workspaceUsername);
      if (session !== sessionRef.current) {
        closeRerunWindow(resultWindow);
        await deleteTemporaryGroup();
        return;
      }
      const { parameters, serviceId } = groupServiceLaunch(service, groupPath);
      const launch = rerunJob(parameters, serviceId, { resultWindow });
      if (launch.status !== "opened") {
        closeRerunWindow(resultWindow);
        await deleteTemporaryGroup();
        setFailure({ message: launch.message });
        return;
      }
      setIsChoosingBlastSource(false);
      onOpenChange(false);
    } catch (serviceError) {
      closeRerunWindow(resultWindow);
      await deleteTemporaryGroup();
      if (session !== sessionRef.current) return;
      reportServiceError(serviceError);
    } finally {
      if (session === sessionRef.current) setPendingService(null);
    }
  };

  const disabled = pendingService !== null || ids.length === 0;
  const options = isChoosingBlastSource
    ? featureBlastSourceOptions
    : kind === "feature"
      ? featureServiceOptions
      : genomeServiceOptions;
  const idLabel = kind === "feature" ? "feature" : "genome";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isChoosingBlastSource
              ? "Select the BLAST source"
              : `Use selected ${label} in a service`}
          </DialogTitle>
          <DialogDescription>
            {!hasSelectableServices
              ? // `label` is always plural, so no article — "a Epitopes" was wrong.
                `Services that accept ${label} are not available yet.`
              : isChoosingBlastSource
                ? "Search with the selection as the query, or search against it as the source database."
                : `Open a supported service with ${ids.length.toLocaleString()} ${idLabel}${ids.length === 1 ? "" : "s"} from the current selection.`}
          </DialogDescription>
        </DialogHeader>
        {hasSelectableServices ? (
          <div className="grid gap-2">
            {options.map((option) => (
              <Button
                key={option.choice}
                disabled={disabled}
                onClick={() => void runService(option)}
              >
                {pendingService === option.choice
                  ? option.pendingLabel
                  : option.label}
              </Button>
            ))}
            {isChoosingBlastSource ? (
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  setFailure(null);
                  setIsChoosingBlastSource(false);
                }}
              >
                Back
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No selectable services
          </p>
        )}
        {failure ? (
          <div className="grid gap-2">
            <p role="alert" className="text-sm text-destructive">
              {failure.message}
            </p>
            {failure.needsSignIn ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={signInHref} target="_blank" rel="noopener" />
                }
              >
                Sign In (opens a new tab)
              </Button>
            ) : null}
          </div>
        ) : null}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
