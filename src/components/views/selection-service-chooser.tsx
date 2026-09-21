"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useSelectionServiceLaunch,
  type SelectionServiceKind,
  type ServiceChoice,
} from "./use-selection-service-launch";

/** Which ID kind the selection resolved to, and so which services accept it. */
export type { SelectionServiceKind } from "./use-selection-service-launch";

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

interface ServiceOption {
  choice: ServiceChoice;
  label: string;
  pendingLabel: string;
}

interface ServiceOptionsProps {
  disabled: boolean;
  isChoosingBlastSource: boolean;
  options: readonly ServiceOption[];
  pendingService: ServiceChoice | null;
  onBack: () => void;
  onSelect: (choice: ServiceChoice) => void;
}

interface ServiceFailureProps {
  failure: { message: string; needsSignIn?: boolean } | null;
  signInHref: string;
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

function ServiceOptions({
  disabled,
  isChoosingBlastSource,
  options,
  pendingService,
  onBack,
  onSelect,
}: ServiceOptionsProps) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <Button
          key={option.choice}
          disabled={disabled}
          onClick={() => {
            onSelect(option.choice);
          }}
        >
          {pendingService === option.choice
            ? option.pendingLabel
            : option.label}
        </Button>
      ))}
      {isChoosingBlastSource ? (
        <Button variant="outline" disabled={disabled} onClick={onBack}>
          Back
        </Button>
      ) : null}
    </div>
  );
}

function ServiceFailure({ failure, signInHref }: ServiceFailureProps) {
  if (!failure) return null;

  return (
    <div className="grid gap-2">
      <p role="alert" className="text-sm text-destructive">
        {failure.message}
      </p>
      {failure.needsSignIn ? (
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={signInHref} target="_blank" rel="noopener" />}
        >
          Sign In (opens a new tab)
        </Button>
      ) : null}
    </div>
  );
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
  const {
    failure,
    isChoosingBlastSource,
    pendingService,
    runService,
    clearFailure,
    showServiceList,
  } = useSelectionServiceLaunch({
    open,
    ids,
    kind,
    workspaceUsername,
    onOpenChange,
  });

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
          <ServiceOptions
            disabled={disabled}
            isChoosingBlastSource={isChoosingBlastSource}
            options={options}
            pendingService={pendingService}
            onBack={() => {
              clearFailure();
              showServiceList();
            }}
            onSelect={runService}
          />
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No selectable services
          </p>
        )}
        <ServiceFailure failure={failure} signInHref={signInHref} />
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
