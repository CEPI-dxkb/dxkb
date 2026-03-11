# Testing Rules

## Test Before Committing

Before committing any changes, run the following commands to ensure that the code is without errors or warnings:

```bash
pnpm lint
pnpm build
```

## Linting Rules

- All variables and constants use `camelCase` — including module-level `const` exports. Do not use `SCREAMING_SNAKE_CASE` for constants (that is a C/Java convention, not TypeScript/JavaScript).
- The only exceptions are environment variable names (OS convention) and zod schema objects which conventionally use camelCase anyway.
- Do not use `//eslint-disable` comments, fix the code instead. If you absolutely must use them, add a comment explaining why.
