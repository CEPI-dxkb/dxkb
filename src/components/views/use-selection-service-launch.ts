"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import type { WorkspaceRepository } from "@/lib/services/workspace/workspace-repository";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import {
  closeRerunWindow,
  rerunJob,
  rerunPopupBlockedMessage,
  reserveRerunWindow,
} from "@/lib/rerun-utility";
export type SelectionServiceKind = "genome" | "feature";

export type ServiceChoice =
  | "blast"
  | "viral-tree"
  | "viral-msa"
  | "feature-blast"
  | "feature-blast-query"
  | "feature-blast-database"
  | "gene-tree"
  | "ha-subtype";

type GroupBackedChoice = Exclude<ServiceChoice, "blast" | "feature-blast">;

export interface ServiceFailure {
  message: string;
  needsSignIn?: boolean;
}

interface UseSelectionServiceLaunchOptions {
  open: boolean;
  ids: readonly string[];
  kind: SelectionServiceKind;
  workspaceUsername?: string;
  onOpenChange: (open: boolean) => void;
}

interface GroupBackedLaunchOptions {
  service: GroupBackedChoice;
  session: number;
  resultWindow: Window;
  createTemporaryGroup: () => Promise<string>;
  deleteTemporaryGroup: (groupPath: string | undefined) => Promise<void>;
  isCurrentSession: (session: number) => boolean;
  onFailure: (failure: unknown) => void;
  onLaunchFailure: (message: string) => void;
  onSuccess: () => void;
  onSettled: () => void;
}

const signInRequiredMessage =
  "Sign in to use this service. Your selection is kept here — sign in, then come back to this tab and try again.";

const genericServiceErrorMessage = "Unable to open the selected service";

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

async function createTemporaryGroup(
  repository: WorkspaceRepository,
  username: string,
  kind: SelectionServiceKind,
  ids: readonly string[],
): Promise<string> {
  const directoryPath = `/${username}/home/._tmp_groups`;
  const groupName = `tmp_${kind}_group_${crypto.randomUUID()}`;

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
}

async function deleteTemporaryGroup(
  repository: WorkspaceRepository,
  groupPath: string | undefined,
): Promise<void> {
  if (!groupPath) return;
  try {
    await repository.delete([groupPath]);
  } catch {
    // Cleanup must not replace the launch failure shown to the user.
  }
}

/**
 * Runs after a result tab has been reserved synchronously by the click handler.
 * Keeping this exact cleanup sequence outside React restores compiler coverage for
 * the hook and chooser without changing stale-session or temporary-group behavior.
 */
async function launchGroupBackedService({
  service,
  session,
  resultWindow,
  createTemporaryGroup,
  deleteTemporaryGroup,
  isCurrentSession,
  onFailure,
  onLaunchFailure,
  onSuccess,
  onSettled,
}: GroupBackedLaunchOptions): Promise<void> {
  let groupPath: string | undefined;
  // Reads `groupPath` at call time: it is still undefined on the catch path when
  // createTemporaryGroup itself threw, and deleteTemporaryGroup no-ops on that.
  const teardown = async () => {
    closeRerunWindow(resultWindow);
    await deleteTemporaryGroup(groupPath);
  };

  try {
    groupPath = await createTemporaryGroup();
    if (!isCurrentSession(session)) {
      await teardown();
      return;
    }

    const { parameters, serviceId } = groupServiceLaunch(service, groupPath);
    const launch = rerunJob(parameters, serviceId, { resultWindow });
    if (launch.status !== "opened") {
      await teardown();
      onLaunchFailure(launch.message);
      return;
    }

    onSuccess();
  } catch (serviceError) {
    await teardown();
    if (!isCurrentSession(session)) return;
    onFailure(serviceError);
  } finally {
    if (isCurrentSession(session)) onSettled();
  }
}

export function useSelectionServiceLaunch({
  open,
  ids,
  kind,
  workspaceUsername,
  onOpenChange,
}: UseSelectionServiceLaunchOptions) {
  const repository = useWorkspaceRepository("authenticated");
  const router = useRouter();
  const [pendingService, setPendingService] = useState<ServiceChoice | null>(
    null,
  );
  const [isChoosingBlastSource, setIsChoosingBlastSource] = useState(false);
  const [failure, setFailure] = useState<ServiceFailure | null>(null);
  const [lastOpen, setLastOpen] = useState(open);
  const sessionRef = useRef(0);

  useEffect(() => {
    sessionRef.current += 1;
  }, [open]);

  if (lastOpen !== open) {
    setLastOpen(open);
    setPendingService(null);
    setIsChoosingBlastSource(false);
    setFailure(null);
  }

  const needsSignIn = failure?.needsSignIn === true;
  if (needsSignIn && workspaceUsername) setFailure(null);

  useEffect(() => {
    if (!needsSignIn) return;
    const refreshSession = () => {
      router.refresh();
    };
    window.addEventListener("focus", refreshSession);
    return () => {
      window.removeEventListener("focus", refreshSession);
    };
  }, [needsSignIn, router]);

  const reportServiceError = (serviceError: unknown) => {
    setFailure({
      message: formatUserFacingErrorMessage(
        serviceError,
        genericServiceErrorMessage,
      ),
    });
  };

  const runService = (service: ServiceChoice) => {
    const session = sessionRef.current;

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
    // This must remain before any async work so popup blockers see the click gesture.
    const resultWindow = reserveRerunWindow();
    if (!resultWindow) {
      setFailure({ message: rerunPopupBlockedMessage });
      return;
    }

    setPendingService(service);
    void launchGroupBackedService({
      service,
      session,
      resultWindow,
      createTemporaryGroup: () =>
        createTemporaryGroup(repository, workspaceUsername, kind, ids),
      deleteTemporaryGroup: (groupPath) =>
        deleteTemporaryGroup(repository, groupPath),
      isCurrentSession: (candidate) => candidate === sessionRef.current,
      onFailure: reportServiceError,
      onLaunchFailure: (message) => {
        setFailure({ message });
      },
      onSuccess: () => {
        setIsChoosingBlastSource(false);
        onOpenChange(false);
      },
      onSettled: () => {
        setPendingService(null);
      },
    });
  };

  return {
    failure,
    isChoosingBlastSource,
    pendingService,
    runService,
    clearFailure: () => {
      setFailure(null);
    },
    showServiceList: () => {
      setIsChoosingBlastSource(false);
    },
  };
}
