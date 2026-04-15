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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignoutButton } from "@/components/auth/signout-button";
import { SuLoginDialog } from "@/components/auth/su-login-dialog";
import { useAuth } from "@/contexts/auth-context";
import { encodeWorkspaceSegment, workspaceUsername } from "@/lib/utils";

import {
  NotebookPen,
  BriefcaseBusiness,
  Settings,
  Mail,
  ShieldUser,
  LogIn,
  LogOut,
} from "lucide-react";

export function UserAvatarDropdown() {
  const {
    user,
    sendVerificationEmail,
    isAdmin,
    isImpersonating,
    suExit,
  } = useAuth();
  const wsUsername = workspaceUsername(user);
  const [suDialogOpen, setSuDialogOpen] = useState(false);

  return (
    <>
      <div className="hover:bg-foreground/10 flex items-center space-x-2 rounded-md px-1 py-1">
        <div className="size-8 shrink-0 overflow-hidden rounded-full **:data-[slot=dropdown-menu-trigger]:size-full **:data-[slot=dropdown-menu-trigger]:min-w-0">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              nativeButton={false}
              render={<div className="flex size-full items-center justify-center" />}
            >
              {isImpersonating ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600">
                  <ShieldUser className="h-5 w-5 text-white" />
                </div>
              ) : (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-white/10 text-white">
                    {user?.username?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" sideOffset={8} align="end" className="w-[200px]">
              <DropdownMenuGroup>
                <DropdownMenuLabel>User Actions</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  render={<Link href={wsUsername ? `/workspace/${encodeWorkspaceSegment(wsUsername)}/home` : "/workspace"} />}
                >
                  <NotebookPen className="text-foreground h-4 w-4" />
                  {isImpersonating
                    ? `${user?.username}'s Workspace`
                    : "My Workspace"}
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/jobs" />}>
                  <BriefcaseBusiness className="text-foreground h-4 w-4" />
                  {isImpersonating
                    ? `${user?.username}'s Jobs`
                    : "My Jobs"}
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/settings" />}>
                  <Settings className="text-foreground h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => sendVerificationEmail()}>
                  <span className="flex items-center gap-2">
                    <Mail className="text-foreground h-4 w-4" />
                    Resend Verification Email
                  </span>
                </DropdownMenuItem>

                {isAdmin && !isImpersonating && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSuDialogOpen(true)}>
                      <LogIn className="text-foreground h-4 w-4" />
                      SU Login
                    </DropdownMenuItem>
                  </>
                )}

                {isImpersonating && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => suExit()}>
                      <LogOut className="text-foreground h-4 w-4" />
                      Exit SU
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <SignoutButton
                  variant="ghost"
                  className="h-auto w-full justify-start gap-2 rounded-md border-none px-1.5 py-1 text-sm shadow-none hover:bg-secondary/80 focus:bg-secondary/80"
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
