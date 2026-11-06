import * as z from "zod/mini";
import en from "zod/v4/locales/en.js";

/**
 * `zod/mini` for client code in always-loaded bundles (root layout, providers,
 * navbars). Classic `zod` registers the English locale when its first schema is
 * built; mini never does, so `prettifyError` would turn every built-in issue into a
 * bare "Invalid input". Register `en` once here (only that locale is bundled) and
 * import this module instead of `zod/mini`.
 */
z.config(en());

export * from "zod/mini";
