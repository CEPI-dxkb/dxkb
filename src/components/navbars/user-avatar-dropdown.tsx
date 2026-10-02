"use client";

import { useState } from "react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeMenuOptions } from "@/components/navbars/theme-menu-options";
import { SignoutButton } from "@/components/auth/signout-button";
import { SuLoginDialog } from "@/components/auth/su-login-dialog";
import {
  useAuth,
  useExitImpersonation,
  useResendVerificationEmail,
} from "@/lib/auth/provider";
import {
  encodeWorkspaceSegment,
  workspaceUsername,
} from "@/lib/services/workspace/path-utils";

import {
  NotebookPen,
  BriefcaseBusiness,
  Settings,
  Contrast,
  Mail,
  ShieldUser,
  LogIn,
  LogOut,
} from "lucide-react";

export function UserAvatarDropdown() {
  const { user, isAdmin, isImpersonating } = useAuth();
  const exitImpersonation = useExitImpersonation();
  const resendVerificationEmail = useResendVerificationEmail();
  const wsUsername = workspaceUsername(user);
  const [suDialogOpen, setSuDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-center space-x-2 rounded-md p-1 hover:bg-foreground/10">
        <div className="size-8 shrink-0 overflow-hidden rounded-full **:data-[slot=dropdown-menu-trigger]:size-full **:data-[slot=dropdown-menu-trigger]:min-w-0">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              nativeButton={false}
              render={
                <div className="flex size-full items-center justify-center" />
              }
            >
              {isImpersonating ? (
                <div className="flex size-8 items-center justify-center rounded-full bg-destructive dark:bg-destructive/60">
                  <ShieldUser className="size-5 text-white" />
                </div>
              ) : (
                <Avatar className="size-8">
                  <AvatarFallback variant="inverse">
                    {user?.username.charAt(0).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              sideOffset={8}
              align="end"
              className="w-60"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel variant="heading">
                  Hello,{" "}
                  <span className="font-semibold">
                    {user?.username ?? "User"}
                  </span>
                  !
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  render={
                    <Link
                      href={
                        wsUsername
                          ? `/workspace/${encodeWorkspaceSegment(wsUsername)}/home`
                          : "/workspace"
                      }
                    />
                  }
                >
                  <NotebookPen className="size-4 text-foreground" />
                  {isImpersonating
                    ? `${user?.username ?? ""}'s Workspace`
                    : "My Workspace"}
                </DropdownMenuItem>

                <DropdownMenuItem render={<Link href="/jobs" />}>
                  <BriefcaseBusiness className="size-4 text-foreground" />
                  {isImpersonating
                    ? `${user?.username ?? ""}'s Jobs`
                    : "My Jobs"}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    void resendVerificationEmail();
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Mail className="size-4 text-foreground" />
                    Resend Verification Email
                  </span>
                </DropdownMenuItem>

                <DropdownMenuItem render={<Link href="/settings" />}>
                  <Settings className="size-4 text-foreground" />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Contrast className="size-4 text-foreground" />
                    Theme
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent side="left" className="w-56">
                    <ThemeMenuOptions />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {isAdmin && !isImpersonating && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setSuDialogOpen(true);
                      }}
                    >
                      <LogIn className="size-4 text-foreground" />
                      SU Login
                    </DropdownMenuItem>
                  </>
                )}

                {isImpersonating && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        void exitImpersonation();
                      }}
                    >
                      <LogOut className="size-4 text-foreground" />
                      Exit SU
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <SignoutButton
                  variant="menu-item"
                  size="menu-item"
                  className="w-full justify-start"
                />
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <SuLoginDialog open={suDialogOpen} onOpenChange={setSuDialogOpen} />
    </>
  );
}
