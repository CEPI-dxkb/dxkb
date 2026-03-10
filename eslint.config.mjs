import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  eslint.configs.recommended,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strict, tseslint.configs.stylistic],
    rules: {
      // note you must disable the base rule
      // as it can report incorrect errors
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": [
        "warn",
        {
          ignoreRestArgs: true,
        },
      ],
    },
  },
);
