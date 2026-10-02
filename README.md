# DXKB V2 — Disease X Knowledge Base

A Next.js 16 bioinformatics platform for genomics, metagenomics, and viral research, built on the BV-BRC (Bacterial and Viral Bioinformatics Resource Center) backend.

---

## Prerequisites

- **Node.js v24** — required by Vitest 4 / rolldown. Use [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  nvm install 24
  nvm use 24
  ```
- **pnpm** — the project's package manager:
  ```bash
  npm install -g pnpm
  ```

---

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .example.env .env.local
```

Fill in `.env.local` with the appropriate values:

| Variable                  | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| `USER_URL`                | BV-BRC User Service URL                                                |
| `USER_AUTH_URL`           | BV-BRC Authentication Service URL                                      |
| `USER_REGISTER_URL`       | BV-BRC Registration Service URL                                        |
| `USER_VERIFICATION_URL`   | BV-BRC Email Verification Service URL                                  |
| `USER_PASSWORD_RESET_URL` | BV-BRC Password Reset Service URL                                      |
| `APP_BASE_URL`            | This tier's public origin, declared on sign-up and jobs (required)     |
| `APP_SERVICE_URL`         | BV-BRC AppService — JSON-RPC endpoint for job submission               |
| `INTERNAL_API_ORIGIN`     | Trusted origin for server-side calls to this Next.js application       |
| `DATA_SERVICE_URL`        | BV-BRC Data Service URL                                                |
| `NEXT_PUBLIC_DATA_API`    | Public-facing data API endpoint                                        |
| `SHOCK_ORIGINS`           | Comma-separated Shock file storage node URLs                           |
| `DEFAULT_REALM`           | Realm used when a BV-BRC token does not include one (default: `bvbrc`) |

> All variables except `NEXT_PUBLIC_DATA_API` are server-side only and never exposed to the browser.

### 3. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3019](http://localhost:3019) in your browser.

---

## Commands

```bash
pnpm dev            # Start dev server with Turbopack on port 3019
pnpm build          # Production build
pnpm start          # Start production server
pnpm lint           # ESLint
pnpm test           # Vitest (run once)
pnpm test:watch     # Vitest (watch mode)
pnpm test:coverage  # Vitest with V8 coverage report
```

---

## Architecture Overview

### App Router structure (`src/app/`)

| Route                                    | Description                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`                                      | Public home page — search, news, statistics                                                                            |
| `/workspace/[username]/home/[[...path]]` | File browser for user workspaces                                                                                       |
| `/services/(category)/...`               | Bioinformatics service submission forms (genomics, metagenomics, phylogenomics, protein-tools, utilities, viral-tools) |
| `/search/`                               | Global search                                                                                                          |
| `/jobs/`                                 | Job monitoring                                                                                                         |
| `/api/auth/...`                          | Retained auth mutations and profile operations; current-user reads and sign-out are server APIs                        |
| `/api/services/...`                      | Proxied service API routes                                                                                             |
| `/api/workspace/...`                     | Proxied workspace API routes                                                                                           |

### Authentication

Authentication is a server-first integration with the BV-BRC identity service.

- Server Components call `getCurrentUser()` and pass a browser-safe user to `<AuthBoundary>`; there is no browser session fetch or token in `AuthUser`.
- `src/lib/auth/server/session.ts` owns the HttpOnly `bvbrc_token`, `bvbrc_user_id`, and optional `bvbrc_realm` cookies. They expire four hours after an identity-changing write and do not roll on reads.
- Protected pages are optimistically gated by `src/proxy.ts`; authoritative checks use `getCurrentUser()` or `withAuth()` server-side.
- Browser mutations use named functions in `src/lib/auth/client.ts`. Explicit sign-out uses a redirecting Server Action that clears cookies before navigation.

### Backend communication

All backend calls use **JSON-RPC 2.0 over HTTP POST**, implemented in `src/lib/jsonrpc-client.ts`. Service wrappers:

- `AppService` (`src/lib/app-service.ts`) — job management: enumerate, query, kill, and submit jobs via `AppService.start_app2`.
- `WorkspaceApiClient` (`src/lib/services/workspace/client.ts`) — workspace CRUD operations.

### UI stack

- [shadcn/ui](https://ui.shadcn.com/) (New York style, Slate base) built on [`@base-ui/react`](https://base-ui.com/) primitives — components live in `src/components/ui/`.
- [Tailwind CSS v4](https://tailwindcss.com/) with CSS variable theming and named themes in `src/app/globals.css`.
- [`lucide-react`](https://lucide.dev/) for icons.
- [`sonner`](https://sonner.emilkowal.ski/) for toast notifications.

### Data layer

- [TanStack Query](https://tanstack.com/query) for all async client-side state.
- [TanStack Table](https://tanstack.com/table) for the workspace file listing (with virtual scrolling via TanStack Virtual).
- [TanStack Form](https://tanstack.com/form) + [Zod](https://zod.dev/) for service submission forms.

---

## Testing

Tests use **Vitest 4** with jsdom and [Mock Service Worker (MSW)](https://mswjs.io/) for API mocking.

- Test files live in `__tests__/` directories next to the source they cover.
- Globals (`describe`, `it`, `expect`, `vi`) are available without importing.
- Run `pnpm test:coverage` to generate a V8 coverage report.

**Before committing, always run:**

```bash
pnpm lint
pnpm build
pnpm test
```

Three GitHub Actions CI workflows run automatically on every PR targeting `main`: lint, build, and test. All must pass before merging.

---

## Key Conventions

- **camelCase everywhere** — all variables and constants, including module-level exports. No `SCREAMING_SNAKE_CASE` (except OS-level env var names).
- **Module-level constants and types** used by a service page belong in that service's `*-form-utils.ts` file, not inline in the component.
- **Do not commit without review** — run the three pre-commit checks above and manually inspect the diff before committing.

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [shadcn/ui](https://ui.shadcn.com/)
- [BV-BRC](https://www.bv-brc.org/)
