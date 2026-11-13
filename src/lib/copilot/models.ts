import type { CopilotModel } from "./types";

export function resolveCopilotModel(
  models: CopilotModel[],
  stored: string | null,
): string | null {
  if (stored && models.some((model) => model.model === stored)) return stored;
  const fallback = models.find((model) => model.isDefault) ?? models.at(0);
  return fallback ? fallback.model : null;
}

/** A model as people read it: without its provider ("openai/gpt-oss-120b" is "gpt-oss-120b"). */
export function shortModelName(model: string): string {
  return model.slice(model.lastIndexOf("/") + 1) || model;
}
