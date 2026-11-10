"use client";

import { Check, ChevronRight, CircleAlert, Hourglass } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";
import type { CopilotStep } from "@/lib/copilot/types";

const stepStatusText: Record<CopilotStep["status"], string> = {
  done: "Done",
  error: "Failed",
  running: "Running",
};

function seconds(ms: number): string {
  return ms < 1000 ? "<1 s" : `${String(Math.round(ms / 100) / 10)} s`;
}

function StepIcon({ status }: { status: CopilotStep["status"] }) {
  if (status === "done") return <Check className="text-success" />;
  if (status === "error") return <CircleAlert className="text-destructive" />;
  return <Spinner role="presentation" aria-label={undefined} />;
}

function StepList({ steps }: { steps: CopilotStep[] }) {
  return (
    <ol className="mt-1 flex flex-col gap-1.5 border-l-2 border-primary/25 pl-3">
      {steps.map((step) => (
        <li key={step.stepId}>
          <Marker>
            <MarkerIcon>
              <StepIcon status={step.status} />
            </MarkerIcon>
            <MarkerContent>
              <span className="sr-only">{stepStatusText[step.status]}: </span>
              <span className="text-foreground">{step.label}</span>
              {step.result && <span> — {step.result}</span>}
              {step.detail && !step.result && <span> — {step.detail}</span>}
              {step.tookMs !== null && (
                <span className="text-2xs"> ({seconds(step.tookMs)})</span>
              )}
            </MarkerContent>
          </Marker>
        </li>
      ))}
    </ol>
  );
}

export function CopilotSteps({
  steps,
  defaultOpen = false,
}: {
  steps: CopilotStep[];
  defaultOpen?: boolean;
}) {
  if (steps.length === 0) return null;
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight
          className="size-3.5 transition-transform group-data-panel-open:rotate-90"
          aria-hidden
        />
        What I did ({steps.length} {steps.length === 1 ? "step" : "steps"})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <StepList steps={steps} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CopilotLiveStatus({
  label,
  queuedMessage,
}: {
  label: string | null;
  queuedMessage: string | null;
}) {
  if (queuedMessage) {
    return (
      <Marker role="status">
        <MarkerIcon>
          <Hourglass />
        </MarkerIcon>
        <MarkerContent>{queuedMessage}</MarkerContent>
      </Marker>
    );
  }
  return (
    <Marker role="status">
      <MarkerIcon>
        <Spinner role="presentation" aria-label={undefined} />
      </MarkerIcon>
      <MarkerContent>
        <span className="shimmer">{label ?? "Thinking…"}</span>
      </MarkerContent>
    </Marker>
  );
}
