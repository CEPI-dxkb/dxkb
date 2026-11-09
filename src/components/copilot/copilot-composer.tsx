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
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { WorkspaceFolderPickerDialog } from "@/components/workspace/folder-picker/folder-picker-dialog-lazy";
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

/**
 * Any workspace file. Folders are opened, not picked; a job result is opened
 * too, to reach its outputs.
 */
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
  /** A turn is running: Send becomes Stop. */
  running: boolean;
  /**
   * Nothing can be sent now (no model yet, the chat is loading, or another
   * answer is running): the box is disabled.
   */
  disabled: boolean;
  /** Bumped to move focus into the box (a suggestion was picked). */
  focusKey?: number;
  executionMode: CopilotExecutionMode;
  onExecutionModeChange: (mode: CopilotExecutionMode) => void;
  attachments: CopilotAttachment[];
  /** Files picked, pasted or dropped; the panel reads and checks them. */
  onAttach: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  /** A note under the box (which model reads the images). */
  note?: string | null;
  /** Replaces the usual placeholder (a plan step's question is open). */
  placeholder?: string;
  /** Sends with only attachments and no text. */
  canSendEmpty?: boolean;
  /** Attached files are still being read: nothing can be sent yet. */
  reading?: boolean;
}

/** The pasted text is just the pasted files' names, one per line. */
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

/** Plan | Execute, as a two-option radio group. */
function ModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: CopilotExecutionMode;
  onChange: (mode: CopilotExecutionMode) => void;
  disabled: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`${copilotName} mode`}
      className="flex items-center rounded-md border p-0.5"
    >
      {modes.map((mode) => (
        <InputGroupButton
          key={mode.value}
          type="button"
          role="radio"
          aria-checked={value === mode.value}
          title={mode.hint}
          size="xs"
          variant={value === mode.value ? "secondary" : "ghost"}
          disabled={disabled}
          onClick={() => {
            onChange(mode.value);
          }}
        >
          {mode.label}
        </InputGroupButton>
      ))}
    </div>
  );
}

/**
 * The question box. Enter sends, Shift+Enter starts a new line (as on
 * BV-BRC); while an answer is being written the button stops it.
 */
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
        // Always cancel a file drag: the browser would otherwise open the
        // file in this tab, replacing the chat.
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
            // Text pasted beside the file (a copied cell, a rich selection)
            // still goes into the box, unless it is only the files' names,
            // which macOS Finder puts beside a copied file.
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
          <span className="text-2xs text-muted-foreground max-sm:hidden">
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
              // aria-disabled, not disabled: InputGroup greys the whole box
              // when any control in it is disabled, and an empty box is not.
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
