import { z } from "zod";

import type { UserProfile } from "@/lib/auth/types";

// ============================================================================
// Profile form
// ============================================================================

export const profileFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string(),
  last_name: z.string().min(1, "Last name is required"),
  affiliation: z.string(),
  organisms: z.string(),
  interests: z.string(),
});

export type ProfileFormData = z.infer<typeof profileFormSchema>;

// ============================================================================
// Password form
// ============================================================================

export const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type PasswordFormData = z.input<typeof passwordFormSchema>;

// ============================================================================
// Patch builder
// ============================================================================

interface JsonPatchOp {
  op: "replace";
  path: string;
  value: string;
}

const editableProfileFields = [
  "email",
  "first_name",
  "middle_name",
  "last_name",
  "affiliation",
  "organisms",
  "interests",
] as const;

/** Compare original and updated profile values, returning only changed fields as JSON Patch ops. */
export function buildProfilePatches(
  original: UserProfile,
  updated: ProfileFormData,
): JsonPatchOp[] {
  const patches: JsonPatchOp[] = [];

  for (const field of editableProfileFields) {
    const oldVal = original[field] ?? "";
    const newVal = updated[field] ?? "";
    if (oldVal !== newVal) {
      patches.push({ op: "replace", path: `/${field}`, value: newVal });
    }
  }

  return patches;
}
