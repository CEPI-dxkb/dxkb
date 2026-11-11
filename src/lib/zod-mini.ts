import * as z from "zod/mini";
import en from "zod/v4/locales/en.js";

/** `zod/mini` registers no locale, so `prettifyError` would say "Invalid input"; this registers `en` once, so import it instead. */
z.config(en());

export * from "zod/mini";
