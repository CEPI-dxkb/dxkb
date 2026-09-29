"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
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

import { useAuth } from "@/lib/auth/provider";
import { signOutAndRedirect } from "@/app/(auth)/redirect-action";
import { encodeQueryComponent } from "@/lib/url";
import { encodeWorkspaceSegment } from "@/lib/services/workspace/path-utils";
import { workspaceUsername } from "@/lib/services/workspace/path-utils";
import {
  serviceItems,
  type NavSection,
} from "@/components/navbars/navbar-links";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandFooterHint,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandShortcutChip,
} from "@/components/ui/command";

import { COMMAND_PALETTE_OPEN_EVENT } from "./command-palette-events";

const SEARCH_ITEM_VALUE = "__dxkb-command-search__";

export function CommandPalette() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const { isAuthenticated, user } = useAuth();
  const wsUsername = workspaceUsername(user);
  const encodedUsername = wsUsername ? encodeWorkspaceSegment(wsUsername) : "";

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setInputValue("");
  };
  const openPalette = useEffectEvent(() => {
    handleOpenChange(true);
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Case-insensitive: CapsLock or Playwright's `Meta+K` send key="K".
      // Browser autofill selection fires a synthetic keydown with no `key`,
      // which the DOM types don't model — hence the widened alias.
      const key = event.key as string | undefined;
      if (key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        // Reset stale input so reopening always starts clean; setInputValue
        // here runs from an event handler, not an effect body.
        setInputValue("");
        setOpen((prev) => !prev);
      }
    };

    const onOpen = () => {
      openPalette();
    };

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
    };
  }, []);

  const runCommand = (action: () => void) => {
    handleOpenChange(false);
    action();
  };

  const navigate = (href: string, target?: "_self" | "_blank") => {
    runCommand(() => {
      if (target === "_blank") {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        router.push(href);
      }
    });
  };

  const runSearch = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    runCommand(() => {
      router.push(`/search?type=everything&q=${encodeQueryComponent(trimmed)}`);
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return key === "genome-meta" || key === "genome-full";
        },
      });
    });
  };

  const handleSignOut = () => {
    runCommand(() => {
      queryClient.clear();
      signOutFormRef.current?.requestSubmit();
    });
  };

  return (
    <>
      <form ref={signOutFormRef} action={signOutAndRedirect} className="hidden">
        <input type="hidden" name="redirectTo" value="/" />
      </form>
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
          >
            <CommandShortcutChip>⌘</CommandShortcutChip>
            <CommandShortcutChip>K</CommandShortcutChip>
          </CommandInput>
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
              <CommandItem
                value="home"
                description="Global dashboard and situational overview"
                onSelect={() => {
                  navigate("/");
                }}
              >
                <Home />
                <span>Home</span>
              </CommandItem>

              {isAuthenticated ? (
                <>
                  {encodedUsername && (
                    <CommandItem
                      value="workspace"
                      description="Your files and saved analyses"
                      onSelect={() => {
                        navigate(`/workspace/${encodedUsername}/home`);
                      }}
                    >
                      <Folder />
                      <span>Workspace</span>
                    </CommandItem>
                  )}
                  <CommandItem
                    value="jobs"
                    description="Monitor running and completed jobs"
                    onSelect={() => {
                      navigate("/jobs");
                    }}
                  >
                    <Briefcase />
                    <span>Jobs</span>
                  </CommandItem>
                  <CommandItem
                    value="settings"
                    description="Account, preferences, and integrations"
                    onSelect={() => {
                      navigate("/settings");
                    }}
                  >
                    <Settings />
                    <span>Settings</span>
                  </CommandItem>
                  <CommandItem
                    value="sign out"
                    description="End your current session"
                    onSelect={handleSignOut}
                  >
                    <LogOut />
                    <span>Sign out</span>
                  </CommandItem>
                </>
              ) : (
                <>
                  <CommandItem
                    value="sign in"
                    description="Access your workspace and tools"
                    onSelect={() => {
                      navigate("/sign-in");
                    }}
                  >
                    <LogIn />
                    <span>Sign in</span>
                  </CommandItem>
                  <CommandItem
                    value="sign up"
                    description="Create a new BV-BRC account"
                    onSelect={() => {
                      navigate("/sign-up");
                    }}
                  >
                    <UserPlus />
                    <span>Sign up</span>
                  </CommandItem>
                </>
              )}
            </CommandGroup>

            {(
              Object.entries(serviceItems) as unknown as [string, NavSection][]
            ).map(([key, section]) => (
              <CommandGroup key={key} heading={section.title}>
                {section.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${section.title} ${item.title}`}
                    onSelect={() => {
                      navigate(item.href, item.target);
                    }}
                  >
                    <span>{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <CommandFooter>
            <CommandFooterHint keys={["↑", "↓"]}>Select</CommandFooterHint>
            <CommandFooterHint keys={["ENTER"]}>Open</CommandFooterHint>
            <CommandFooterHint keys={["ESC"]}>Close</CommandFooterHint>
          </CommandFooter>
        </Command>
      </CommandDialog>
    </>
  );
}
