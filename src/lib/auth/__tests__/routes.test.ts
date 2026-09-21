import { isProtectedPagePath } from "../routes";

describe("isProtectedPagePath", () => {
  it("returns true for /services/ sub-paths", () => {
    expect(isProtectedPagePath("/services/blast")).toBe(true);
    expect(isProtectedPagePath("/services/genome-annotation")).toBe(true);
  });

  it("returns false for the /services index only", () => {
    expect(isProtectedPagePath("/services")).toBe(false);
    expect(isProtectedPagePath("/services/")).toBe(false);
    expect(isProtectedPagePath("/services-old")).toBe(false);
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

  it("protects workspace paths that resemble the public exceptions", () => {
    expect(isProtectedPagePath("/workspace/publicXYZ")).toBe(true);
    expect(isProtectedPagePath("/workspace/workshops")).toBe(true);
    expect(isProtectedPagePath("/workspace/publicity")).toBe(true);
  });

  it("does not classify unrelated prefix lookalikes as protected", () => {
    expect(isProtectedPagePath("/workspaces")).toBe(false);
    expect(isProtectedPagePath("/jobs-board")).toBe(false);
    expect(isProtectedPagePath("/settings-guide")).toBe(false);
    expect(isProtectedPagePath("/viewers")).toBe(false);
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
