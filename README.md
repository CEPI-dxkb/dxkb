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

| Variable | Description |
|---|---|
| `USER_URL` | BV-BRC User Service URL |
| `USER_AUTH_URL` | BV-BRC Authentication Service URL |
| `USER_VERIFICATION_URL` | BV-BRC Email Verification Service URL |
| `APP_SERVICE_URL` | BV-BRC AppService — JSON-RPC endpoint for job submission |
| `DATA_SERVICE_URL` | BV-BRC Data Service URL |
| `NEXT_PUBLIC_DATA_API` | Public-facing data API endpoint |
| `SHOCK_ORIGINS` | Comma-separated Shock file storage node URLs |
| `BETTER_AUTH_SECRET` | Session encryption key — generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Base URL of the app (default: `http://localhost:3019`) |

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

| Route | Description |
|---|---|
| `/` | Public home page — search, news, statistics |
| `/workspace/[username]/home/[[...path]]` | File browser for user workspaces |
| `/services/(category)/...` | Bioinformatics service submission forms (genomics, metagenomics, phylogenomics, protein-tools, utilities, viral-tools) |
| `/search/` | Global search |
| `/jobs/` | Job monitoring |
| `/api/auth/...` | Custom auth API routes (sign-in, sign-up, sign-out, session, etc.) |
| `/api/services/...` | Proxied service API routes |
| `/api/workspace/...` | Proxied workspace API routes |

### Authentication

Auth is custom-built on [`better-auth`](https://www.better-auth.com/) with **stateless sessions — no database required**.

- Auth state lives in `AuthContext` (`src/contexts/auth-context.tsx`), hydrated from `user_profile` and `user_id` cookies set by the server.
- Protected routes (`/services/*`, `/workspace/*`) are guarded by Next.js middleware in `src/proxy.ts`, which checks for `bvbrc_token` and `bvbrc_user_id` cookies.
- Key files: `src/lib/auth.ts` (server-side), `src/lib/auth-client.ts` (client-side).

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
- [better-auth](https://www.better-auth.com/)
- [BV-BRC](https://www.bv-brc.org/)
