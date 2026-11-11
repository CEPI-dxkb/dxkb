"use client";

import {
  ArrowUp,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Paperclip,
  Square,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  copilotAttachmentAccept,
  maxCopilotAttachments,
  type CopilotAttachment,
} from "@/lib/copilot/attachments";
import type { CopilotExecutionMode } from "@/lib/copilot/types";
import type { PickerTarget } from "@/lib/services/workspace/picker-views";
import {
  knownUploadTypes,
  otherWorkspaceObjectTypes,
  viewableTypes,
} from "@/lib/services/workspace/types";
import { copilotName } from "@/lib/copilot/name";

const WorkspaceFolderPickerDialog = dynamic(
  () =>
    import("@/components/workspace/folder-picker/folder-picker-dialog").then(
      (module) => module.WorkspaceFolderPickerDialog,
    ),
  { ssr: false },
);

const anyWorkspaceFile: PickerTarget = {
  kind: "object",
  types: [
    ...new Set<string>([
      ...Object.keys(knownUploadTypes),
      ...otherWorkspaceObjectTypes.filter(
        (type) => type !== "folder" && type !== "job_result",
      ),
      ...viewableTypes,
    ]),
  ],
};

export interface CopilotComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  running: boolean;
  disabled: boolean;
  focusKey?: number;
  executionMode: CopilotExecutionMode;
  onExecutionModeChange: (mode: CopilotExecutionMode) => void;
  attachments: CopilotAttachment[];
  onAttach: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  note?: string | null;
  placeholder?: string;
  canSendEmpty?: boolean;
  reading?: boolean;
}

function isPastedFileNames(text: string, files: File[]): boolean {
  const lines = text
    .trim()
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .sort();
  const names = files.map((file) => file.name).sort();
  return (
    lines.length === names.length &&
    lines.every((line, index) => line === names[index])
  );
}

const attachmentIcons: Record<CopilotAttachment["kind"], React.ReactNode> = {
  image: <ImageIcon aria-hidden />,
  pdf: <FileText aria-hidden />,
  file: <Paperclip aria-hidden />,
};

function AttachmentChips({
  attachments,
  onRemove,
  disabled,
}: {
  attachments: CopilotAttachment[];
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Attached files">
      {attachments.map((attachment) => (
        <li
          key={attachment.id}
          className="flex max-w-60 items-center gap-1 rounded-md border bg-muted py-0.5 pr-0.5 pl-1.5 text-xs [&_svg]:size-3 [&_svg]:shrink-0"
          title={attachment.name}
        >
          {attachmentIcons[attachment.kind]}
          <span className="truncate">{attachment.name}</span>
          <InputGroupButton
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={`Remove ${attachment.name}`}
            disabled={disabled}
            onClick={() => {
              onRemove(attachment.id);
            }}
          >
            <X aria-hidden />
          </InputGroupButton>
        </li>
      ))}
    </ul>
  );
}

const modes: { value: CopilotExecutionMode; label: string; hint: string }[] = [
  {
    value: "plan",
    label: "Plan",
    hint: `Plan: ${copilotName} prepares jobs and asks before submitting them.`,
  },
  {
    value: "execute",
    label: "Execute",
    hint: `Execute: ${copilotName} may submit jobs and create groups without asking.`,
  },
];

function ModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: CopilotExecutionMode;
  onChange: (mode: CopilotExecutionMode) => void;
  disabled: boolean;
}) {
  const hintId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={`${copilotName} mode`}
      className="flex items-center rounded-md border p-0.5"
    >
      {/* A tooltip, not a title: a title shows late, and never on touch. */}
      {modes.map((mode) => (
        <Tooltip key={mode.value}>
          <TooltipTrigger
            render={
              <InputGroupButton
                type="button"
                role="radio"
                aria-checked={value === mode.value}
                aria-describedby={`${hintId}-${mode.value}`}
                size="xs"
                variant={value === mode.value ? "secondary" : "ghost"}
                disabled={disabled}
                onClick={() => {
                  onChange(mode.value);
                }}
              >
                {mode.label}
              </InputGroupButton>
            }
          />
          <TooltipContent>{mode.hint}</TooltipContent>
        </Tooltip>
      ))}
      {modes.map((mode) => (
        <span key={mode.value} id={`${hintId}-${mode.value}`} hidden>
          {mode.hint}
        </span>
      ))}
    </div>
  );
}

export function CopilotComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  running,
  disabled,
  focusKey = 0,
  executionMode,
  onExecutionModeChange,
  attachments,
  onAttach,
  onRemoveAttachment,
  note,
  placeholder,
  canSendEmpty = false,
  reading = false,
}: CopilotComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const canSend =
    !running &&
    !disabled &&
    !reading &&
    (value.trim() !== "" || (canSendEmpty && attachments.length > 0));
  const canAttach = !disabled && attachments.length < maxCopilotAttachments;

  const insertPath = (path: string) => {
    const box = textareaRef.current;
    const at = box?.selectionStart ?? value.length;
    const before = value.slice(0, at);
    const after = value.slice(at);
    const spaced = `${before && !/\s$/.test(before) ? " " : ""}${path}${after && !/^\s/.test(after) ? " " : ""}`;
    onChange(`${before}${spaced}${after}`);
    requestAnimationFrame(() => {
      box?.focus();
      const caret = before.length + spaced.length;
      box?.setSelectionRange(caret, caret);
    });
  };

  useEffect(() => {
    if (focusKey > 0) textareaRef.current?.focus();
  }, [focusKey]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (canSend) onSubmit();
  };

  return (
    <form
      className="border-t bg-background p-3 data-dragging:bg-muted"
      data-dragging={dragging || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        // Always cancel a file drag, or the browser opens the file in this tab.
        event.preventDefault();
        event.dataTransfer.dropEffect = canAttach ? "copy" : "none";
        setDragging(canAttach);
      }}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={(event) => {
        setDragging(false);
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        if (canAttach && event.dataTransfer.files.length > 0) {
          onAttach([...event.dataTransfer.files]);
        }
      }}
    >
      {executionMode === "execute" && (
        <p className="mb-2 text-xs text-warning">
          Execute mode: {copilotName} may submit jobs and create groups without
          asking first.
        </p>
      )}
      <AttachmentChips
        attachments={attachments}
        onRemove={onRemoveAttachment}
        disabled={running}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={copilotAttachmentAccept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length > 0) onAttach(files);
        }}
      />
      <InputGroup>
        <InputGroupTextarea
          ref={textareaRef}
          value={value}
          rows={1}
          aria-label={`Ask ${copilotName}`}
          placeholder={
            placeholder ??
            (executionMode === "execute"
              ? `Ask, or tell ${copilotName} what to run…`
              : "Ask about genomes, pathogens, or analyses…")
          }
          disabled={disabled}
          className="max-h-40 min-h-10"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const files = [...event.clipboardData.files];
            if (files.length === 0 || !canAttach) return;
            // Text pasted beside files still goes into the box, unless it is only the files' names
            // (macOS Finder adds those).
            const text = event.clipboardData.getData("text/plain");
            if (text === "" || isPastedFileNames(text, files)) {
              event.preventDefault();
            }
            onAttach(files);
          }}
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Attach files"
            aria-busy={reading || undefined}
            title={`Attach images, text files or PDFs (up to ${String(maxCopilotAttachments)})`}
            disabled={!canAttach || running}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip aria-hidden />
          </InputGroupButton>
          <InputGroupButton
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Insert a workspace file path"
            title="Insert a workspace file path"
            disabled={disabled || running}
            onClick={() => {
              setPickerOpen(true);
            }}
          >
            <FolderOpen aria-hidden />
          </InputGroupButton>
          <ModeToggle
            value={executionMode}
            onChange={onExecutionModeChange}
            disabled={running || disabled}
          />
          <span className="hidden text-2xs text-muted-foreground sm:group-focus-within/input-group:inline">
            Shift+Enter for a new line
          </span>
          {running ? (
            <InputGroupButton
              type="button"
              variant="default"
              size="icon-xs"
              className="ml-auto"
              aria-label="Stop answering"
              title="Stop"
              onClick={onStop}
            >
              <Square aria-hidden />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              size="icon-xs"
              className="ml-auto"
              aria-label="Send"
              title="Send"
              // aria-disabled, not disabled: InputGroup greys the whole box when any control in it
              // is disabled.
              aria-disabled={!canSend}
              variant={canSend ? "default" : "secondary"}
            >
              <ArrowUp aria-hidden />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      {note && <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>}
      {pickerOpen && (
        <WorkspaceFolderPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          target={anyWorkspaceFile}
          title="Insert a workspace file path"
          onSelect={(path) => {
            insertPath(path);
          }}
        />
      )}
    </form>
  );
}
