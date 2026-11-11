import type { CopilotModel } from "./types";

export function resolveCopilotModel(
  models: CopilotModel[],
  stored: string | null,
): string | null {
  if (stored && models.some((model) => model.model === stored)) return stored;
  const fallback = models.find((model) => model.isDefault) ?? models.at(0);
  return fallback ? fallback.model : null;
}
