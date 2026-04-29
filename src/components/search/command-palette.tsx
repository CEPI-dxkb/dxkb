"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Folder,
  Home,
  LogIn,
  LogOut,
  Search,
  Settings,
  UserPlus,
} from "lucide-react";

import { useAuth } from "@/lib/auth/hooks";
import { encodeWorkspaceSegment } from "@/lib/utils";
import { workspaceUsername } from "@/components/navbars/workspace-dropdown-content";
import { serviceItems } from "@/components/navbars/navbar-links";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

const COMMAND_PALETTE_OPEN_EVENT = "dxkb:open-command-palette";
const SEARCH_ITEM_VALUE = "__dxkb-command-search__";

/**
 * Imperatively open the global command palette. Used by visible trigger
 * buttons (mobile / a11y); the keyboard shortcut handler lives inside the
 * mounted `<CommandPalette>` itself.
 */
export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT));
}

export function CommandPalette() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, signOut } = useAuth();
  const wsUsername = workspaceUsername(user);
  const encodedUsername = wsUsername ? encodeWorkspaceSegment(wsUsername) : "";

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setInputValue("");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        // Reset stale input so reopening always starts clean; setInputValue
        // here runs from an event handler, not an effect body.
        setInputValue("");
        setOpen((prev) => !prev);
      }
    };

    const onOpen = () => handleOpenChange(true);

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
    };
  }, [handleOpenChange]);

  const runCommand = useCallback(
    (action: () => void) => {
      handleOpenChange(false);
      action();
    },
    [handleOpenChange],
  );

  const navigate = useCallback(
    (href: string, target?: "_self" | "_blank") => {
      runCommand(() => {
        if (target === "_blank") {
          window.open(href, "_blank", "noopener,noreferrer");
        } else {
          router.push(href);
        }
      });
    },
    [router, runCommand],
  );

  const runSearch = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    runCommand(() => {
      router.push(
        `/search?q=${encodeURIComponent(trimmed)}&searchtype=everything`,
      );
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return key === "genome-meta" || key === "genome-full";
        },
      });
    });
  }, [inputValue, queryClient, router, runCommand]);

  const handleSignOut = useCallback(() => {
    runCommand(async () => {
      try {
        await signOut();
      } finally {
        router.push("/");
      }
    });
  }, [router, runCommand, signOut]);

  return (
    <CommandDialog
      title="Command Palette"
      description="Search DXKB or jump to a page"
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Command
        filter={(value, search) => {
          if (value === SEARCH_ITEM_VALUE) {
            return search.length > 0 ? 1 : 0;
          }
          if (!search) return 1;
          return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
        }}
      >
        <CommandInput
          placeholder="Search DXKB or jump to a page..."
          value={inputValue}
          onValueChange={setInputValue}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {inputValue.trim() && (
            <CommandGroup heading="Search">
              <CommandItem value={SEARCH_ITEM_VALUE} onSelect={runSearch}>
                <Search />
                <span>Search for &ldquo;{inputValue.trim()}&rdquo;</span>
                <CommandShortcut>Enter</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          )}

          <CommandGroup heading="Navigate">
            <CommandItem value="home" onSelect={() => navigate("/")}>
              <Home />
              <span>Home</span>
            </CommandItem>

            {isAuthenticated ? (
              <>
                {encodedUsername && (
                  <CommandItem
                    value="workspace"
                    onSelect={() =>
                      navigate(`/workspace/${encodedUsername}/home`)
                    }
                  >
                    <Folder />
                    <span>Workspace</span>
                  </CommandItem>
                )}
                <CommandItem value="jobs" onSelect={() => navigate("/jobs")}>
                  <Briefcase />
                  <span>Jobs</span>
                </CommandItem>
                <CommandItem
                  value="settings"
                  onSelect={() => navigate("/settings")}
                >
                  <Settings />
                  <span>Settings</span>
                </CommandItem>
                <CommandItem value="sign out" onSelect={handleSignOut}>
                  <LogOut />
                  <span>Sign out</span>
                </CommandItem>
              </>
            ) : (
              <>
                <CommandItem
                  value="sign in"
                  onSelect={() => navigate("/sign-in")}
                >
                  <LogIn />
                  <span>Sign in</span>
                </CommandItem>
                <CommandItem
                  value="sign up"
                  onSelect={() => navigate("/sign-up")}
                >
                  <UserPlus />
                  <span>Sign up</span>
                </CommandItem>
              </>
            )}
          </CommandGroup>

          <CommandSeparator />

          {Object.entries(serviceItems).map(([key, section]) => (
            <CommandGroup key={key} heading={section.title}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${section.title} ${item.title}`}
                  onSelect={() => navigate(item.href, item.target)}
                >
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
