"use client";

import { useState } from "react";
import { toast } from "sonner";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";

import { useAuthActions } from "@/lib/auth/provider";
import type { UserProfile } from "@/lib/auth/types";

interface PreferencesFormProps {
  profile: UserProfile;
}

export function PreferencesForm({ profile }: PreferencesFormProps) {
  const { updateProfile } = useAuthActions();
  const [defaultJobFolder, setDefaultJobFolder] = useState(
    profile.settings?.default_job_folder ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    const currentValue = profile.settings?.default_job_folder ?? "";
    if (defaultJobFolder === currentValue) {
      toast.info("No changes to save.");
      return;
    }

    setIsSubmitting(true);
    await updateProfile([
      {
        op: "replace",
        path: "/settings",
        value: { default_job_folder: defaultJobFolder },
      },
    ])
      .then(() => {
        toast.success("Preferences updated successfully.");
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error && error.message
            ? `Failed to update preferences: ${error.message}`
            : "Failed to update preferences.",
        );
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Configure your default settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Default Job Output Folder</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <WorkspaceObjectSelector
                  preset="folder"
                  placeholder="Select a default output folder..."
                  value={defaultJobFolder}
                  onObjectSelect={(object) => {
                    setDefaultJobFolder(object.path || "");
                  }}
                />
              </div>
              {defaultJobFolder && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => {
                    setDefaultJobFolder("");
                  }}
                  aria-label="Clear default job output folder"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Set a default folder for job outputs. Leave empty to use home
              folder.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={isSubmitting}
            className="w-fit"
          >
            {isSubmitting ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
