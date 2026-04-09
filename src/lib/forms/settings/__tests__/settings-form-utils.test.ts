import type { UserProfile } from "@/lib/auth/types";
import {
  profileFormSchema,
  passwordFormSchema,
  buildProfilePatches,
  type ProfileFormData,
} from "../settings-form-utils";

describe("profileFormSchema", () => {
  it("accepts valid profile data", () => {
    const result = profileFormSchema.safeParse({
      email: "test@example.com",
      first_name: "John",
      middle_name: "",
      last_name: "Doe",
      affiliation: "Lab",
      organisms: "SARS-CoV-2",
      interests: "Genomics",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = profileFormSchema.safeParse({
      email: "not-an-email",
      first_name: "John",
      middle_name: "",
      last_name: "Doe",
      affiliation: "",
      organisms: "",
      interests: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty first_name", () => {
    const result = profileFormSchema.safeParse({
      email: "test@example.com",
      first_name: "",
      middle_name: "",
      last_name: "Doe",
      affiliation: "",
      organisms: "",
      interests: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty last_name", () => {
    const result = profileFormSchema.safeParse({
      email: "test@example.com",
      first_name: "John",
      middle_name: "",
      last_name: "",
      affiliation: "",
      organisms: "",
      interests: "",
    });

    expect(result.success).toBe(false);
  });

  it("allows empty optional fields", () => {
    const result = profileFormSchema.safeParse({
      email: "test@example.com",
      first_name: "John",
      middle_name: "",
      last_name: "Doe",
      affiliation: "",
      organisms: "",
      interests: "",
    });

    expect(result.success).toBe(true);
  });
});

describe("passwordFormSchema", () => {
  it("accepts valid password change data", () => {
    const result = passwordFormSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "newpass456",
      confirmPassword: "newpass456",
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty current password", () => {
    const result = passwordFormSchema.safeParse({
      currentPassword: "",
      newPassword: "newpass456",
      confirmPassword: "newpass456",
    });

    expect(result.success).toBe(false);
  });

  it("rejects new password shorter than 8 characters", () => {
    const result = passwordFormSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "short",
      confirmPassword: "short",
    });

    expect(result.success).toBe(false);
  });

  it("rejects when new password matches current password", () => {
    const result = passwordFormSchema.safeParse({
      currentPassword: "samepass123",
      newPassword: "samepass123",
      confirmPassword: "samepass123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("newPassword");
    }
  });

  it("rejects when confirm password does not match new password", () => {
    const result = passwordFormSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "newpass456",
      confirmPassword: "different789",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("confirmPassword");
    }
  });

  it("rejects empty confirm password", () => {
    const result = passwordFormSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "newpass456",
      confirmPassword: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("buildProfilePatches", () => {
  const baseProfile: UserProfile = {
    id: "user1",
    email: "old@example.com",
    first_name: "Old",
    middle_name: "M",
    last_name: "Name",
    affiliation: "Old Lab",
    organisms: "E. coli",
    interests: "Bioinformatics",
    email_verified: true,
    creation_date: "2024-01-01",
    l_id: "l1",
    last_login: "2024-06-01",
    reverification: false,
    source: "bvbrc",
  };

  it("returns empty array when nothing changed", () => {
    const updated: ProfileFormData = {
      email: "old@example.com",
      first_name: "Old",
      middle_name: "M",
      last_name: "Name",
      affiliation: "Old Lab",
      organisms: "E. coli",
      interests: "Bioinformatics",
    };

    expect(buildProfilePatches(baseProfile, updated)).toEqual([]);
  });

  it("returns patches for changed fields only", () => {
    const updated: ProfileFormData = {
      email: "new@example.com",
      first_name: "New",
      middle_name: "M",
      last_name: "Name",
      affiliation: "Old Lab",
      organisms: "E. coli",
      interests: "Bioinformatics",
    };

    const patches = buildProfilePatches(baseProfile, updated);

    expect(patches).toEqual([
      { op: "replace", path: "/email", value: "new@example.com" },
      { op: "replace", path: "/first_name", value: "New" },
    ]);
  });

  it("handles all fields changing", () => {
    const updated: ProfileFormData = {
      email: "new@example.com",
      first_name: "New",
      middle_name: "X",
      last_name: "Surname",
      affiliation: "New Lab",
      organisms: "SARS-CoV-2",
      interests: "Genomics",
    };

    const patches = buildProfilePatches(baseProfile, updated);

    expect(patches).toHaveLength(7);
    expect(patches.map((p) => p.path)).toEqual([
      "/email",
      "/first_name",
      "/middle_name",
      "/last_name",
      "/affiliation",
      "/organisms",
      "/interests",
    ]);
  });

  it("treats undefined original values as empty strings", () => {
    const profileWithMissing = {
      ...baseProfile,
      middle_name: undefined,
      affiliation: undefined,
    } as UserProfile;

    const updated: ProfileFormData = {
      email: "old@example.com",
      first_name: "Old",
      middle_name: "",
      last_name: "Name",
      affiliation: "",
      organisms: "E. coli",
      interests: "Bioinformatics",
    };

    expect(buildProfilePatches(profileWithMissing, updated)).toEqual([]);
  });

  it("detects change when original is undefined and updated is non-empty", () => {
    const profileWithMissing = {
      ...baseProfile,
      affiliation: undefined,
    } as UserProfile;

    const updated: ProfileFormData = {
      email: "old@example.com",
      first_name: "Old",
      middle_name: "M",
      last_name: "Name",
      affiliation: "New Lab",
      organisms: "E. coli",
      interests: "Bioinformatics",
    };

    const patches = buildProfilePatches(profileWithMissing, updated);

    expect(patches).toEqual([
      { op: "replace", path: "/affiliation", value: "New Lab" },
    ]);
  });
});
