import {
  workshopBrowserHref,
  workshopWorkspacePath,
} from "../workshop";

describe("workshop workspace", () => {
  it("is the public folder legacy BV-BRC calls BV-BRC Workshop", () => {
    expect(workshopWorkspacePath).toBe(
      "/ARWattam@patricbrc.org/BV-BRC Workshop",
    );
  });

  it("links the workspace browser's public route to the same folder", () => {
    expect(workshopBrowserHref).toBe(
      "/workspace/public/ARWattam@patricbrc.org/BV-BRC%20Workshop",
    );
  });
});
