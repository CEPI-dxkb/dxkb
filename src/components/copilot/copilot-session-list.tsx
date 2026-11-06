"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopilotSessions } from "@/hooks/copilot/use-copilot-queries";
import {
  copilotQueryKeys,
  deleteCopilotSession,
  renameCopilotSession,
} from "@/lib/copilot/client";
import type { CopilotSessionSummary } from "@/lib/copilot/types";

function when(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : formatDistanceToNow(date, { addSuffix: true });
}

function RenameForm({
  session,
  onDone,
}: {
  session: CopilotSessionSummary;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(session.title);
  const rename = useMutation({
    mutationFn: (next: string) => renameCopilotSession(session.sessionId, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: copilotQueryKeys.sessions() });
      onDone();
    },
    onError: (error) => {
      toast.error("Could not rename the chat", { description: error.message });
    },
  });
  return (
    <form
      className="flex items-center gap-1 px-2 py-1"
      onSubmit={(event) => {
        event.preventDefault();
        const next = title.trim();
        if (next && next !== session.title) rename.mutate(next);
        else onDone();
      }}
    >
      <Input
        autoFocus
        value={title}
        aria-label="Chat title"
        maxLength={200}
        disabled={rename.isPending}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDone();
        }}
      />
      <Button type="submit" size="sm" disabled={rename.isPending}>
        Save
      </Button>
    </form>
  );
}

function SessionRow({
  session,
  current,
  onSelect,
  onRename,
  onDelete,
}: {
  session: CopilotSessionSummary;
  current: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const updated = when(session.lastModified ?? session.createdAt);
  return (
    <li className="group flex items-center gap-1 rounded-md pr-1 hover:bg-muted aria-current:bg-muted" aria-current={current}>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onSelect}
      >
        <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{session.title}</span>
          <span className="flex items-center gap-1 text-2xs text-muted-foreground">
            {session.activeJobId && (
              <span className="inline-flex items-center gap-1 text-info">
                <span className="size-1.5 rounded-full bg-info" aria-hidden />
                Running
              </span>
            )}
            {updated}
          </span>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-xs" aria-label={`Options for ${session.title}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>
            <Pencil aria-hidden />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/**
 * The user's chats, newest first. Selecting one opens it; deleting the open
 * one starts a new chat.
 */
export function CopilotSessionList({
  currentSessionId,
  onSelect,
  onDeletedCurrent,
}: {
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDeletedCurrent: () => void;
}) {
  const queryClient = useQueryClient();
  const sessions = useCopilotSessions(true);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CopilotSessionSummary | null>(null);

  const remove = useMutation({
    mutationFn: (sessionId: string) => deleteCopilotSession(sessionId),
    onSuccess: (_data, sessionId) => {
      if (sessionId === currentSessionId) onDeletedCurrent();
      queryClient.removeQueries({ queryKey: copilotQueryKeys.session(sessionId) });
      void queryClient.invalidateQueries({ queryKey: copilotQueryKeys.sessions() });
      setDeleting(null);
    },
    onError: (error) => {
      toast.error("Could not delete the chat", { description: error.message });
    },
  });

  if (sessions.isPending) {
    return (
      <div className="flex flex-col gap-2 p-2" aria-busy="true" aria-label="Loading chats">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (sessions.isError) {
    return (
      <div className="p-2">
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>
            <p>{sessions.error.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void sessions.refetch();
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const all = sessions.data.pages.flatMap((page) => page.sessions);

  return (
    <div className="flex flex-col gap-1 p-2">
      {all.length === 0 ? (
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">
          No chats yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5" aria-label="Your chats">
          {all.map((session) =>
            renaming === session.sessionId ? (
              <li key={session.sessionId}>
                <RenameForm
                  session={session}
                  onDone={() => {
                    setRenaming(null);
                  }}
                />
              </li>
            ) : (
              <SessionRow
                key={session.sessionId}
                session={session}
                current={session.sessionId === currentSessionId}
                onSelect={() => {
                  onSelect(session.sessionId);
                }}
                onRename={() => {
                  setRenaming(session.sessionId);
                }}
                onDelete={() => {
                  setDeleting(session);
                }}
              />
            ),
          )}
        </ul>
      )}
      {sessions.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          disabled={sessions.isFetchingNextPage}
          onClick={() => {
            void sessions.fetchNextPage();
          }}
        >
          {sessions.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting?.title}&rdquo; will be removed from your chat
              list here and on BV-BRC. Jobs it submitted are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (deleting) remove.mutate(deleting.sessionId);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
