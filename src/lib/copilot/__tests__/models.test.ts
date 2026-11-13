import { resolveCopilotModel, shortModelName } from "@/lib/copilot/models";
import type { CopilotModel } from "@/lib/copilot/types";

function model(name: string, isDefault = false): CopilotModel {
  return {
    model: name,
    modelType: null,
    priority: null,
    maxTokens: null,
    supportsImage: false,
    isDefault,
  };
}

describe("resolveCopilotModel", () => {
  const models = [model("first"), model("default", true), model("picked")];

  it("keeps the stored model while the gateway still offers it", () => {
    expect(resolveCopilotModel(models, "picked")).toBe("picked");
  });

  it("falls back to the gateway's default, then to its first model", () => {
    expect(resolveCopilotModel(models, "retired")).toBe("default");
    expect(resolveCopilotModel(models, null)).toBe("default");
    expect(resolveCopilotModel([model("first"), model("second")], "retired")).toBe("first");
  });

  it("is null when the gateway offers no models", () => {
    expect(resolveCopilotModel([], "picked")).toBeNull();
    expect(resolveCopilotModel([], null)).toBeNull();
  });
});

describe("shortModelName", () => {
  it.each([
    ["openai/gpt-oss-120b", "gpt-oss-120b"],
    ["together/meta-llama/Llama-3.3-70B", "Llama-3.3-70B"],
    ["gpt-oss-120b", "gpt-oss-120b"],
    ["trailing/", "trailing/"],
  ])("shows %s as %s", (full, short) => {
    expect(shortModelName(full)).toBe(short);
  });
});
