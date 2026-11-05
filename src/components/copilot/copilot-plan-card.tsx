"use client";

import {
  ArrowDown,
  ArrowUp,
  Circle,
  CircleCheck,
  CirclePause,
  CircleX,
  ListChecks,
  Loader2,
  MessageCircleQuestion,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Trash2,
} from "lucide-react";
import { createContext, useContext, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applyPlanUpdates,
  copilotPlanAgents,
  copilotPlanState,
  newPlanStepId,
  type CopilotPlan,
  type CopilotPlanStep,
  type CopilotPlanStepStatus,
  type CopilotPlanStepUpdate,
} from "@/lib/copilot/plan";
import type { CopilotWorkflowWatch } from "@/lib/copilot/types";

/**
 * What a plan card can do; provided by the panel that sends turns. Only the
 * newest plan in a chat runs or changes.
 */
export interface CopilotPlanActions {
  currentPlanId: string | null;
  /** A turn is running (here, or in another tab): nothing starts now. */
  busy: boolean;
  /** Step updates from the turn running now. */
  liveUpdates: CopilotPlanStepUpdate[];
  /** The jobs the chat's gateway watches, when read. */
  watches: CopilotWorkflowWatch[] | undefined;
  isPaused: (planId: string) => boolean;
  /** Approve a draft and run it from the first step. */
  run: (plan: CopilotPlan) => void;
  /** Run the next step (Continue, Resume, after the jobs finished). */
  continuePlan: (plan: CopilotPlan) => void;
  /** Stop after the step that is running. */
  pause: (plan: CopilotPlan) => void;
  retryStep: (plan: CopilotPlan, stepIndex: number) => void;
  skipStep: (plan: CopilotPlan, stepIndex: number) => void;
  /** Ask for a new plan for the same request. */
  regenerate: (messageId: string) => void;
  /** Save edited steps; resolves to whether they were saved. */
  saveSteps: (plan: CopilotPlan, steps: CopilotPlanStep[]) => Promise<boolean>;
}

const PlanActionsContext = createContext<CopilotPlanActions | null>(null);
export const CopilotPlanActionsProvider = PlanActionsContext.Provider;

const statusText: Record<CopilotPlanStepStatus, string> = {
  pending: "Not started",
  running: "Running",
  completed: "Done",
  failed: "Failed",
  skipped: "Skipped",
  needs_input: "Waiting for your answer",
  awaiting_approval: "Waiting for your approval",
};

function StepIcon({ status }: { status: CopilotPlanStepStatus }) {
  const label = statusText[status];
  switch (status) {
    case "running":
      return <Loader2 className="size-4 animate-spin text-info" aria-label={label} />;
    case "completed":
      return <CircleCheck className="size-4 text-success" aria-label={label} />;
    case "failed":
      return <CircleX className="size-4 text-destructive" aria-label={label} />;
    case "skipped":
      return <SkipForward className="size-4 text-muted-foreground" aria-label={label} />;
    case "needs_input":
      return <MessageCircleQuestion className="size-4 text-warning" aria-label={label} />;
    case "awaiting_approval":
      return <CirclePause className="size-4 text-warning" aria-label={label} />;
    case "pending":
      return <Circle className="size-4 text-muted-foreground" aria-label={label} />;
  }
}

function clip(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

/**
 * Whether the jobs a plan waits for are done: every one the gateway watches
 * has ended. A job it does not list is taken as still running (Continue now
 * stays offered either way).
 */
function jobsFinished(
  submissionIds: string[],
  watches: CopilotWorkflowWatch[] | undefined,
): boolean {
  if (!watches) return false;
  return submissionIds.every((id) => {
    const watch = watches.find((entry) => entry.submissionId === id);
    return watch !== undefined && watch.status !== "active";
  });
}

function StepRow({
  step,
  index,
  actions,
}: {
  step: CopilotPlanStep;
  index: number;
  actions: React.ReactNode;
}) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 shrink-0">
        <StepIcon status={step.status} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p>
          <span className="text-muted-foreground">{index + 1}. </span>
          {step.description}
          <Badge variant="secondary" className="ml-1.5 align-middle">
            {step.agent}
          </Badge>
        </p>
        {step.status === "completed" && step.resultSummary && (
          <p className="text-xs text-muted-foreground">{clip(step.resultSummary, 300)}</p>
        )}
        {step.status === "failed" && (
          <p className="text-xs text-destructive">
            {clip(step.errorMessage ?? "The step failed.", 500)}
          </p>
        )}
        {step.status === "needs_input" && (
          <p className="text-xs text-muted-foreground">
            Answer its question below, or type a reply.
          </p>
        )}
        {step.status === "awaiting_approval" && (
          <p className="text-xs text-muted-foreground">
            Answer the approval question below to go on.
          </p>
        )}
        {actions}
      </div>
    </li>
  );
}

/** Editing the steps not run yet: text, agent, order; add and delete. */
function PlanEditor({
  plan,
  onCancel,
  onSave,
}: {
  plan: CopilotPlan;
  onCancel: () => void;
  onSave: (steps: CopilotPlanStep[]) => Promise<boolean>;
}) {
  const [steps, setSteps] = useState(plan.steps);
  const [saving, setSaving] = useState(false);
  const editable = (step: CopilotPlanStep) => step.status === "pending";
  // Steps that already ran stay first and fixed.
  const firstEditable = steps.findIndex(editable);
  const invalid = steps.some((step) => editable(step) && step.description.trim() === "");

  const update = (index: number, change: Partial<CopilotPlanStep>) => {
    setSteps((current) => current.with(index, { ...current[index], ...change }));
  };
  const move = (index: number, by: -1 | 1) => {
    setSteps((current) => {
      const next = current.slice();
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid || saving) return;
        setSaving(true);
        void onSave(steps.map((step) => ({ ...step, description: step.description.trim() }))).then(
          (saved) => {
            if (!saved) setSaving(false);
          },
        );
      }}
    >
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) =>
          editable(step) ? (
            <li key={step.stepId} className="flex flex-col gap-1.5 rounded-md border p-2">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Step {index + 1}
                </span>
                <span className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move step ${String(index + 1)} up`}
                  disabled={index <= firstEditable}
                  onClick={() => {
                    move(index, -1);
                  }}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move step ${String(index + 1)} down`}
                  disabled={index === steps.length - 1}
                  onClick={() => {
                    move(index, 1);
                  }}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete step ${String(index + 1)}`}
                  disabled={steps.length === 1}
                  onClick={() => {
                    setSteps((current) => current.filter((_, at) => at !== index));
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <Textarea
                value={step.description}
                rows={2}
                aria-label={`Step ${String(index + 1)}: what to do`}
                aria-invalid={step.description.trim() === "" || undefined}
                onChange={(event) => {
                  update(index, { description: event.target.value });
                }}
              />
              <Select
                items={copilotPlanAgents.map((agent) => ({ value: agent, label: agent }))}
                value={step.agent}
                onValueChange={(value) => {
                  if (typeof value === "string") update(index, { agent: value });
                }}
              >
                <SelectTrigger size="sm" aria-label={`Step ${String(index + 1)}: agent`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {copilotPlanAgents.map((agent) => (
                      <SelectItem key={agent} value={agent}>
                        {agent}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </li>
          ) : (
            <StepRow key={step.stepId} step={step} index={index} actions={null} />
          ),
        )}
      </ol>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={steps.length >= 30}
          onClick={() => {
            setSteps((current) => [
              ...current,
              {
                stepId: newPlanStepId({ steps: current }),
                description: "",
                agent: "data",
                dependsOn: [],
                status: "pending",
                resultSummary: null,
                errorMessage: null,
              },
            ]);
          }}
        >
          <Plus aria-hidden />
          Add a step
        </Button>
      </div>
      {invalid && (
        <p role="alert" className="text-xs text-destructive">
          Every step needs a description.
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * A multi-step plan. Draft: Run plan, Edit, Regenerate. Running: the steps
 * update as they go, and Pause stops it after the running step. A failed step
 * can be retried or skipped; jobs a step submitted are waited for, then the
 * plan continues on request.
 */
export function PlanCardView({
  messageId,
  plan: stored,
  live,
}: {
  messageId: string;
  plan: CopilotPlan;
  /** Shown inside the answer being written: no actions yet. */
  live?: boolean;
}) {
  const actions = useContext(PlanActionsContext);
  const [editing, setEditing] = useState(false);
  const plan = actions ? applyPlanUpdates(stored, actions.liveUpdates) : stored;
  const current = !live && actions !== null && actions.currentPlanId === plan.planId;
  const busy = actions?.busy ?? true;
  const paused = actions?.isPaused(plan.planId) ?? false;
  const state = copilotPlanState(plan);
  const runningIndex = plan.steps.findIndex((step) => step.status === "running");
  const done = plan.steps.filter(
    (step) => step.status === "completed" || step.status === "skipped",
  ).length;
  const canAct = current && !busy && !editing;

  const badge =
    state.kind === "draft"
      ? "Draft"
      : state.kind === "completed"
        ? "Completed"
        : busy && runningIndex !== -1
          ? `Running ${String(done)}/${String(plan.steps.length)}`
          : state.kind === "waitingForJobs"
            ? "Waiting for jobs"
            : state.kind === "failed"
              ? "Stopped: a step failed"
              : state.kind === "waitingForUser"
                ? "Waiting for you"
                : `Paused ${String(done)}/${String(plan.steps.length)}`;

  const stepActions = (index: number) => {
    if (!canAct) return null;
    const step = plan.steps[index];
    const interrupted = step.status === "running";
    const retryable = step.status === "failed" || interrupted;
    const skippable = retryable || step.status === "needs_input" || step.status === "awaiting_approval";
    if (!skippable) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {retryable && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              actions.retryStep(plan, index);
            }}
          >
            <RotateCcw aria-hidden />
            {interrupted ? "Run again" : "Retry"}
          </Button>
        )}
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            actions.skipStep(plan, index);
          }}
        >
          <SkipForward aria-hidden />
          Skip step
        </Button>
      </div>
    );
  };

  const footer = (() => {
    if (!actions || live) return null;
    if (!current) {
      return state.kind === "draft" ? (
        <p className="text-xs text-muted-foreground">A newer plan replaced this one.</p>
      ) : null;
    }
    if (state.kind === "draft") {
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!canAct}
            onClick={() => {
              actions.run(plan);
            }}
          >
            <Play aria-hidden />
            Run plan
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canAct}
            onClick={() => {
              setEditing(true);
            }}
          >
            <Pencil aria-hidden />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canAct}
            onClick={() => {
              actions.regenerate(messageId);
            }}
          >
            <RefreshCw aria-hidden />
            Regenerate
          </Button>
        </div>
      );
    }
    if (state.kind === "completed") {
      return <p className="text-xs text-success">All steps are done.</p>;
    }
    if (busy && runningIndex !== -1) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground" role="status">
            {paused
              ? `Pausing after step ${String(runningIndex + 1)}…`
              : `Running step ${String(runningIndex + 1)}…`}
          </p>
          {!paused && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                actions.pause(plan);
              }}
            >
              <CirclePause aria-hidden />
              Pause
            </Button>
          )}
        </div>
      );
    }
    const editButton = (
      <Button
        size="sm"
        variant="outline"
        disabled={!canAct || !plan.steps.some((step) => step.status === "pending")}
        onClick={() => {
          setEditing(true);
        }}
      >
        <Pencil aria-hidden />
        Edit remaining steps
      </Button>
    );
    if (state.kind === "waitingForJobs") {
      const finished = jobsFinished(state.submissionIds, actions.watches);
      const count = state.submissionIds.length;
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground" role="status">
            {finished
              ? count === 1
                ? "The job finished."
                : "The jobs finished."
              : count === 1
                ? "Waiting for the submitted job to finish (checked every 30 seconds)."
                : `Waiting for ${String(count)} submitted jobs to finish (checked every 30 seconds).`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={finished ? "default" : "outline"}
              disabled={!canAct}
              onClick={() => {
                actions.continuePlan(plan);
              }}
            >
              <Play aria-hidden />
              {finished ? "Continue plan" : "Continue now"}
            </Button>
            {editButton}
          </div>
        </div>
      );
    }
    if (state.kind === "ready") {
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!canAct}
            onClick={() => {
              actions.continuePlan(plan);
            }}
          >
            <Play aria-hidden />
            Continue with step {state.stepIndex + 1}
          </Button>
          {editButton}
        </div>
      );
    }
    return null;
  })();

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm">
      <header className="flex flex-wrap items-center gap-2">
        <ListChecks className="size-4 text-muted-foreground" aria-hidden />
        <h4 className="min-w-0 flex-1 font-medium">{plan.title}</h4>
        <Badge variant={state.kind === "completed" ? "secondary" : "outline"}>{badge}</Badge>
      </header>
      {plan.description && (
        <p className="text-xs text-muted-foreground">{plan.description}</p>
      )}
      {editing && actions ? (
        <PlanEditor
          plan={plan}
          onCancel={() => {
            setEditing(false);
          }}
          onSave={async (steps) => {
            const saved = await actions.saveSteps(plan, steps);
            if (saved) setEditing(false);
            return saved;
          }}
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {plan.steps.map((step, index) => (
            <StepRow
              key={step.stepId}
              step={step}
              index={index}
              actions={stepActions(index)}
            />
          ))}
        </ol>
      )}
      {!editing && footer}
    </section>
  );
}
