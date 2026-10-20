import { formatPrefixedErrorMessage } from "@/lib/utils";

describe("formatPrefixedErrorMessage", () => {
  it("puts the reason behind what failed", () => {
    expect(
      formatPrefixedErrorMessage(
        "Failed to update profile",
        new Error("The BV-BRC profile service is unavailable (HTTP 503)."),
      ),
    ).toBe(
      "Failed to update profile: The BV-BRC profile service is unavailable (HTTP 503).",
    );
  });

  it.each([
    ["a non-Error rejection", { status: 503 }],
    ["an empty message", new Error("   ")],
  ])("is the prefix alone for %s", (_case, error) => {
    expect(formatPrefixedErrorMessage("Failed to change password", error)).toBe(
      "Failed to change password.",
    );
  });

  it("does not repeat a reason that already names the action", () => {
    expect(
      formatPrefixedErrorMessage(
        "Failed to update profile",
        new Error("failed to update profile"),
      ),
    ).toBe("failed to update profile");
  });

  it("condenses a long reason instead of dropping it", () => {
    const message = formatPrefixedErrorMessage(
      "Failed to send verification email",
      new Error("x".repeat(1_000)),
    );
    expect(message.startsWith("Failed to send verification email: xxx")).toBe(
      true,
    );
    expect(message.endsWith("…")).toBe(true);
    expect(message.length).toBeLessThan(400);
  });
});
