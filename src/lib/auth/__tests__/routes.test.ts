import { isProtectedPagePath, isProtectedApiPath } from "../routes";

describe("isProtectedPagePath", () => {
  it("returns true for /services/ sub-paths", () => {
    expect(isProtectedPagePath("/services/blast")).toBe(true);
    expect(isProtectedPagePath("/services/genome-annotation")).toBe(true);
  });

  it("returns false for /services exactly (index page)", () => {
    expect(isProtectedPagePath("/services")).toBe(false);
  });

  it("returns true for /workspace paths", () => {
    expect(isProtectedPagePath("/workspace")).toBe(true);
    expect(isProtectedPagePath("/workspace/user1/home")).toBe(true);
  });

  it("returns false for /workspace/public exact path and sub-paths", () => {
    expect(isProtectedPagePath("/workspace/public")).toBe(false);
    expect(isProtectedPagePath("/workspace/public/")).toBe(false);
    expect(isProtectedPagePath("/workspace/public/user@bvbrc")).toBe(false);
    expect(isProtectedPagePath("/workspace/public/user@bvbrc/home")).toBe(false);
  });

  it("returns false for /workspace/workshop exact path and sub-paths", () => {
    expect(isProtectedPagePath("/workspace/workshop")).toBe(false);
    expect(isProtectedPagePath("/workspace/workshop/")).toBe(false);
    expect(isProtectedPagePath("/workspace/workshop/some-event")).toBe(false);
  });

  it("does not match paths that share the prefix but are different routes", () => {
    expect(isProtectedPagePath("/workspace/publicXYZ")).toBe(true);
    expect(isProtectedPagePath("/workspace/workshops")).toBe(true);
    expect(isProtectedPagePath("/workspace/publicity")).toBe(true);
  });

  it("returns true for /jobs paths", () => {
    expect(isProtectedPagePath("/jobs")).toBe(true);
    expect(isProtectedPagePath("/jobs/123")).toBe(true);
  });

  it("returns true for /settings paths", () => {
    expect(isProtectedPagePath("/settings")).toBe(true);
    expect(isProtectedPagePath("/settings/profile")).toBe(true);
  });

  it("returns true for /viewer paths", () => {
    expect(isProtectedPagePath("/viewer")).toBe(true);
    expect(isProtectedPagePath("/viewer/structure")).toBe(true);
    expect(isProtectedPagePath("/viewer/structure/some/file.pdb")).toBe(true);
  });

  it("returns false for public paths", () => {
    expect(isProtectedPagePath("/")).toBe(false);
    expect(isProtectedPagePath("/search")).toBe(false);
    expect(isProtectedPagePath("/sign-in")).toBe(false);
    expect(isProtectedPagePath("/about")).toBe(false);
  });
});

describe("isProtectedApiPath", () => {
  it("returns true for /api/protected/ sub-paths", () => {
    expect(isProtectedApiPath("/api/protected/some-endpoint")).toBe(true);
    expect(isProtectedApiPath("/api/protected/nested/path")).toBe(true);
  });

  it("returns false for non-protected API paths", () => {
    expect(isProtectedApiPath("/api/auth/sign-in")).toBe(false);
    expect(isProtectedApiPath("/api/services/workspace")).toBe(false);
  });

  it("returns false for non-API paths", () => {
    expect(isProtectedApiPath("/services/blast")).toBe(false);
    expect(isProtectedApiPath("/")).toBe(false);
  });
});
