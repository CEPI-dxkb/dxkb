"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import type { UserProfile } from "@/lib/auth/types";

interface PreferencesFormProps {
  profile: UserProfile;
}

export function PreferencesForm({ profile }: PreferencesFormProps) {
  const queryClient = useQueryClient();
  const authenticatedFetch = useAuthenticatedFetch();
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
    try {
      const hasExistingSettings = profile.settings !== undefined;
      const response = await authenticatedFetch("/api/auth/profile", {
        method: "POST",
        body: JSON.stringify([
          {
            op: hasExistingSettings ? "replace" : "add",
            path: "/settings",
            value: { default_job_folder: defaultJobFolder },
          },
        ]),
      });

      if (!response.ok) {
        const err = await response.json();
        toast.error(err.message || "Failed to update preferences.");
        return;
      }

      toast.success("Preferences updated successfully.");
      await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    } catch {
      toast.error("Failed to update preferences.");
    } finally {
      setIsSubmitting(false);
    }
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
                  types={["folder"]}
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
                  className="h-9 w-9 shrink-0"
                  onClick={() => setDefaultJobFolder("")}
                  aria-label="Clear default job output folder"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Set a default folder for job outputs. Leave empty to use home
              folder.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleSave}
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
