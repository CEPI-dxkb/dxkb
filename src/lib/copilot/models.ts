import type { CopilotModel } from "./types";

/**
 * The model to use: the user's last pick while the gateway still offers it,
 * else the gateway's default, else its first.
 */
export function resolveCopilotModel(
  models: CopilotModel[],
  stored: string | null,
): string | null {
  if (stored && models.some((model) => model.model === stored)) return stored;
  const fallback = models.find((model) => model.isDefault) ?? models.at(0);
  return fallback ? fallback.model : null;
}
