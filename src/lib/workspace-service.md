# Workspace Service

The `WorkspaceService` class provides a centralized interface for all workspace-related operations, abstracting the underlying AppService calls and maintaining consistent "job" terminology in the frontend while handling "task" terminology internally for the API.

## Overview

This service layer solves the confusion between "tasks" (API terminology) and "jobs" (frontend terminology) by:

- Providing a clean, consistent API using "job" terminology
- Handling the mapping to "task" terminology internally
- Centralizing all AppService calls in one place

## Usage

### Creating a Service Instance

```typescript
import { createWorkspaceService } from "@/lib/workspace-service";

const workspaceService = createWorkspaceService(token);
```

### Available Methods

#### `enumerateJobs(params?)`

Maps to `AppService.enumerate_tasks`

```typescript
const jobs = await workspaceService.enumerateJobs({
  offset: 0,
  limit: 100,
  status_filter: ["running", "completed"],
  app_filter: ["app1", "app2"],
});
```

#### `queryJobs(params)`

Maps to `AppService.query_tasks`

```typescript
const jobs = await workspaceService.queryJobs({
  job_ids: ["job1", "job2", "job3"],
});
```

#### `queryJobSummary(params)`

Maps to `AppService.query_task_summary`

```typescript
const summary = await workspaceService.queryJobSummary({
  job_id: "job123",
});
```

#### `queryJobDetails(params)`

Maps to `AppService.query_task_details`

```typescript
const details = await workspaceService.queryJobDetails({
  job_id: "job123",
  include_logs: true,
});
```

#### `killJob(params)`

Maps to `AppService.kill_task`

```typescript
const result = await workspaceService.killJob({
  job_id: "job123",
});
```

## API Routes

The API routes have been updated to use this service:

- `GET /api/workspace/tasks` - Enumerate jobs
- `POST /api/workspace/tasks/query` - Query specific jobs
- `GET /api/workspace/tasks/[id]` - Get job details
- `GET /api/workspace/tasks/[id]/summary` - Get job summary
- `POST /api/workspace/tasks/[id]/kill` - Kill a job

## Frontend Hooks

The `use-workspace.ts` hook provides React hooks for all workspace operations:

- `useEnumerateJobs()` - Hook for listing jobs
- `useQueryJobs()` - Hook for querying specific jobs
- `useJobSummary()` - Hook for getting job summaries
- `useJobDetails()` - Hook for getting detailed job information
- `useKillJob()` - Hook for killing jobs

## Benefits

1. **Consistent Terminology**: Frontend code always uses "job" terminology
2. **Centralized Logic**: All AppService calls are in one place
3. **Type Safety**: Full TypeScript support with proper types
4. **Maintainability**: Easy to update API calls or add new functionality
5. **Error Handling**: Consistent error handling across all operations
