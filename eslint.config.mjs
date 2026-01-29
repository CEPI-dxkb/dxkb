import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  "rules": {
  // note you must disable the base rule
  // as it can report incorrect errors
  "no-unused-vars": "off",
  "@typescript-eslint/no-unused-vars": [
    "warn", // or "error"
    {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_",
      "caughtErrorsIgnorePattern": "^_"
    }
  ],
  "@typescript-eslint/no-explicit-any": [
    "warn",
    {
      "ignoreRestArgs": true,
    }
  ]
}
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
}];

export default eslintConfig;
