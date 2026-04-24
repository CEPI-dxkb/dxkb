import type { JsonOverride } from "../../mocks/backends";

export const mockJobs = [
  {
    id: "job-001",
    app: "GenomeAssembly",
    status: "completed",
    start_time: "2026-04-01T10:00:00Z",
    end_time: "2026-04-01T10:30:00Z",
    params: { paired_end_libs: [{ read1: "r1.fastq", read2: "r2.fastq" }] },
  },
  {
    id: "job-002",
    app: "ProteomeComparison",
    status: "running",
    start_time: "2026-04-20T12:00:00Z",
    end_time: null,
    params: {},
  },
];

export const jobsOverrides: JsonOverride[] = [
  {
    url: /\/api\/services\/app-service\/jobs\/enumerate-tasks-filtered$/,
    method: "POST",
    body: { jobs: mockJobs, totalTasks: mockJobs.length },
  },
  {
    url: /\/api\/services\/app-service\/jobs\/job-001(?:\?|$)/,
    method: "GET",
    body: mockJobs[0],
  },
  {
    url: /\/api\/services\/app-service\/submit$/,
    method: "POST",
    body: { id: "job-new", status: "queued" },
  },
  {
    url: /\/api\/services\/app-service\/.*\/stdout/,
    method: "GET",
    body: { stdout: "Starting job...\nDone.\n" },
  },
  {
    url: /\/api\/services\/app-service\/.*\/stderr/,
    method: "GET",
    body: { stderr: "" },
  },
];
