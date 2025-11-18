"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from "react";
import { useWorkspace } from "../../../../hooks/use-workspace";
import { JobStatus, JobListItem } from "../../../../types/workspace";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Alert, AlertDescription } from "../../../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { Separator } from "../../../../components/ui/separator";
import {
  RefreshCw,
  Search,
  Eye,
  StopCircle,
  Download,
  MoreHorizontal,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pause,
  Play,
  FileText,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const statusColors: Record<JobStatus, string> = {
  pending: "bg-yellow-500",
  queued: "bg-blue-500",
  running: "bg-green-500",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
  error: "bg-red-600",
};

const statusLabels: Record<JobStatus, string> = {
  pending: "Pending",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  error: "Error",
};

// Enhanced skeleton components
function JobsHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-10 w-24" />
    </div>
  );
}

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6 text-center">
            <Skeleton className="mx-auto mb-2 h-8 w-12" />
            <Skeleton className="mx-auto h-4 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="w-10 p-4">
                <Skeleton className="h-4 w-4" />
              </th>
              {Array.from({ length: 7 }).map((_, i) => (
                <th key={i} className="p-4 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="border-b">
                <td className="p-4">
                  <Skeleton className="h-4 w-4" />
                </td>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="p-4">
                    <Skeleton className="h-4 w-24" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function JobsV2LoadingFallback() {
  return (
    <div className="w-full space-y-6">
      <JobsHeaderSkeleton />
      <SummaryCardsSkeleton />
      <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
        <Skeleton className="h-10 flex-1" />
        <div className="flex space-x-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <TableSkeleton />
    </div>
  );
}

type SortField =
  | "id"
  | "app"
  | "status"
  | "submit_time"
  | "start_time"
  | "completed_time";
type SortDirection = "asc" | "desc";

interface JobModalData extends JobListItem {
  parameters: any;
  duration?: string;
  user?: string;
}

// Main jobs content component
function JobsV2Content() {
  const { jobs, enumerateJobs, killJob, getJobDetails, loading, error } =
    useWorkspace();
  const isMountedRef = useRef(false);

  // State management
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("submit_time");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedJobModal, setSelectedJobModal] = useState<JobModalData | null>(
    null,
  );
  const [modalLoading, setModalLoading] = useState(false);

  // Load jobs on mount
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      enumerateJobs();
    }
  }, []);

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = jobs.filter((job) => {
      if (!job?.id || !job?.app) return false;

      const matchesSearch =
        job.id.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.app.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.parameters?.output_file &&
          job.parameters.output_file
            .toLowerCase()
            .includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" || job.status === statusFilter;
      const matchesApp = appFilter === "all" || job.app === appFilter;

      return matchesSearch && matchesStatus && matchesApp;
    });

    // Sort jobs
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date fields
      if (sortField.includes("time")) {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Handle string fields
      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue?.toLowerCase() || "";
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [jobs, searchTerm, statusFilter, appFilter, sortField, sortDirection]);

  // Get unique apps for filter
  const uniqueApps = useMemo(() => {
    return Array.from(
      new Set(jobs.map((job) => job.app).filter(Boolean)),
    ).sort();
  }, [jobs]);

  // Get status counts
  const statusCounts = useMemo(() => {
    return {
      total: jobs.length,
      completed: jobs.filter((j) => j.status === "completed").length,
      running: jobs.filter((j) => j.status === "running").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      queued: jobs.filter((j) => j.status === "queued").length,
    };
  }, [jobs]);

  // Handlers
  const handleRefresh = () => {
    enumerateJobs();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(new Set(filteredAndSortedJobs.map((job) => job.id)));
    } else {
      setSelectedJobs(new Set());
    }
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    const newSelected = new Set(selectedJobs);
    if (checked) {
      newSelected.add(jobId);
    } else {
      newSelected.delete(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handleKillJob = async (jobId: string) => {
    try {
      await killJob(jobId);
      toast.success("Job killed successfully");
      enumerateJobs();
    } catch (error) {
      toast.error("Failed to kill job");
      console.error("Failed to kill job:", error);
    }
  };

  const handleViewJobDetails = async (job: JobListItem) => {
    setModalLoading(true);
    try {
      const details = await getJobDetails(job.id, false);
      const duration =
        job.start_time && job.completed_time
          ? formatDuration(job.start_time, job.completed_time)
          : job.start_time
            ? formatDuration(job.start_time)
            : undefined;

      setSelectedJobModal({
        ...job,
        ...details,
        duration,
        user: "admin", // This would come from the job details in a real implementation
      });
    } catch (error) {
      toast.error("Failed to load job details");
      console.error("Failed to load job details:", error);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCopyJobId = (jobId: string) => {
    navigator.clipboard.writeText(jobId);
    toast.success("Job ID copied to clipboard");
  };

  // Utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = endTime - startTime;

    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="text-muted-foreground h-4 w-4" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="text-primary h-4 w-4" />
    ) : (
      <ArrowDown className="text-primary h-4 w-4" />
    );
  };

  const isAllSelected =
    selectedJobs.size === filteredAndSortedJobs.length &&
    filteredAndSortedJobs.length > 0;
  const isIndeterminate =
    selectedJobs.size > 0 && selectedJobs.size < filteredAndSortedJobs.length;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Jobs Dashboard</h1>
        <Button onClick={handleRefresh} disabled={loading.enumerate}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading.enumerate ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error.enumerate && (
        <Alert variant="destructive">
          <AlertDescription>
            Error loading jobs: {error.enumerate}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">{statusCounts.total}</div>
            <div className="text-muted-foreground text-sm tracking-wide uppercase">
              Total Tasks
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {statusCounts.completed}
            </div>
            <div className="text-muted-foreground text-sm tracking-wide uppercase">
              Completed
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {statusCounts.running}
            </div>
            <div className="text-muted-foreground text-sm tracking-wide uppercase">
              Running
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-red-600">
              {statusCounts.failed}
            </div>
            <div className="text-muted-foreground text-sm tracking-wide uppercase">
              Failed
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {statusCounts.queued}
            </div>
            <div className="text-muted-foreground text-sm tracking-wide uppercase">
              Queued
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
            <Input
              placeholder="Search by job ID, output name, or service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex space-x-2">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as JobStatus | "all")
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(statusLabels).map(([status, label]) => (
                <SelectItem key={status} value={status}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={appFilter} onValueChange={setAppFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Application" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {uniqueApps.map((app) => (
                <SelectItem key={app} value={app}>
                  {app}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">Export CSV</Button>
          <Button>New Job</Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedJobs.size > 0 && (
        <Card className="bg-muted/50 border-primary/20">
          <CardContent className="flex items-center justify-between p-4">
            <div className="text-sm font-medium">
              {selectedJobs.size} job{selectedJobs.size > 1 ? "s" : ""} selected
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download All
              </Button>
              <Button variant="outline" size="sm">
                <Play className="mr-2 h-4 w-4" />
                Rerun Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jobs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="w-10 p-4">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="p-4 text-left text-sm font-semibold tracking-wide uppercase">
                  <button
                    onClick={() => handleSort("id")}
                    className="hover:text-primary flex items-center space-x-1"
                  >
                    <span>ID</span>
                    {getSortIcon("id")}
                  </button>
                </th>
                <th className="p-4 text-left text-sm font-semibold tracking-wide uppercase">
                  <button
                    onClick={() => handleSort("app")}
                    className="hover:text-primary flex items-center space-x-1"
                  >
                    <span>Service</span>
                    {getSortIcon("app")}
                  </button>
                </th>
                <th className="p-4 text-left text-sm font-semibold tracking-wide uppercase">
                  Output Name
                </th>
                <th className="p-4 text-left text-sm font-semibold tracking-wide uppercase">
                  <button
                    onClick={() => handleSort("status")}
                    className="hover:text-primary flex items-center space-x-1"
                  >
                    <span>Status</span>
                    {getSortIcon("status")}
                  </button>
                </th>
                <th className="p-4 text-left text-sm font-semibold tracking-wide uppercase">
                  <button
                    onClick={() => handleSort("submit_time")}
                    className="hover:text-primary flex items-center space-x-1"
                  >
                    <span>Submitted</span>
                    {getSortIcon("submit_time")}
                  </button>
                </th>
                <th className="p-4 text-left text-sm font-semibold tracking-wide uppercase">
                  <button
                    onClick={() => handleSort("start_time")}
                    className="hover:text-primary flex items-center space-x-1"
                  >
                    <span>Started</span>
                    {getSortIcon("start_time")}
                  </button>
                </th>
                <th className="p-4 text-left text-sm font-semibold tracking-wide uppercase">
                  <button
                    onClick={() => handleSort("completed_time")}
                    className="hover:text-primary flex items-center space-x-1"
                  >
                    <span>Completed</span>
                    {getSortIcon("completed_time")}
                  </button>
                </th>
                <th className="p-4 text-left text-sm font-semibold tracking-wide uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-muted-foreground p-8 text-center"
                  >
                    <div>
                      <p>No jobs found</p>
                      <p className="text-sm">
                        {searchTerm ||
                        statusFilter !== "all" ||
                        appFilter !== "all"
                          ? "Try adjusting your filters"
                          : "You haven't submitted any jobs yet"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedJobs.map((job) => (
                  <tr
                    key={job.id}
                    className={`hover:bg-muted/50 cursor-pointer border-b transition-colors ${
                      selectedJobs.has(job.id) ? "bg-primary/5" : ""
                    }`}
                    onClick={() => handleViewJobDetails(job)}
                  >
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedJobs.has(job.id)}
                        onChange={(e) =>
                          handleSelectJob(job.id, e.target.checked)
                        }
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="text-muted-foreground p-4 font-mono text-sm">
                      {job.id}
                    </td>
                    <td className="text-primary p-4 font-medium">{job.app}</td>
                    <td
                      className="max-w-48 truncate p-4"
                      title={job.parameters?.output_file}
                    >
                      {job.parameters?.output_file || "N/A"}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant="secondary"
                        className={`${statusColors[job.status]} text-white`}
                      >
                        {statusLabels[job.status]}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground p-4 text-sm">
                      {formatDate(job.submit_time)}
                    </td>
                    <td className="text-muted-foreground p-4 text-sm">
                      {job.start_time ? formatDate(job.start_time) : "N/A"}
                    </td>
                    <td className="text-muted-foreground p-4 text-sm">
                      {job.completed_time
                        ? formatDate(job.completed_time)
                        : "N/A"}
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/workspace/jobs/${job.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyJobId(job.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {(job.status === "running" ||
                          job.status === "queued") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleKillJob(job.id)}
                            disabled={loading.kill}
                          >
                            <StopCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          Showing 1-{Math.min(filteredAndSortedJobs.length, 50)} of{" "}
          {filteredAndSortedJobs.length} results
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" disabled>
            ← Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-primary text-primary-foreground"
          >
            1
          </Button>
          <Button variant="outline" size="sm">
            2
          </Button>
          <Button variant="outline" size="sm">
            3
          </Button>
          <Button variant="outline" size="sm">
            Next →
          </Button>
        </div>
      </div>

      {/* Job Details Modal */}
      <Dialog
        open={!!selectedJobModal}
        onOpenChange={() => setSelectedJobModal(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedJobModal?.app} - Job Details</span>
              <div className="flex items-center space-x-2">
                <Badge
                  variant="secondary"
                  className={
                    selectedJobModal
                      ? `${statusColors[selectedJobModal.status]} text-white`
                      : ""
                  }
                >
                  {selectedJobModal
                    ? statusLabels[selectedJobModal.status]
                    : ""}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          {modalLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : selectedJobModal ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                    Job ID
                  </div>
                  <div className="font-mono">{selectedJobModal.id}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                    Service
                  </div>
                  <div>{selectedJobModal.app}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                    Status
                  </div>
                  <div>
                    <Badge
                      variant="secondary"
                      className={`${statusColors[selectedJobModal.status]} text-white`}
                    >
                      {statusLabels[selectedJobModal.status]}
                    </Badge>
                  </div>
                </div>
                {selectedJobModal.duration && (
                  <div className="space-y-2">
                    <div className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                      Duration
                    </div>
                    <div>{selectedJobModal.duration}</div>
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <div className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                    Output Name
                  </div>
                  <div className="bg-muted rounded p-2 font-mono text-sm">
                    {selectedJobModal.parameters?.output_file || "N/A"}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                    Submitted
                  </div>
                  <div>{formatDate(selectedJobModal.submit_time)}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                    Started
                  </div>
                  <div>
                    {selectedJobModal.start_time
                      ? formatDate(selectedJobModal.start_time)
                      : "N/A"}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                    Completed
                  </div>
                  <div>
                    {selectedJobModal.completed_time
                      ? formatDate(selectedJobModal.completed_time)
                      : "N/A"}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                    User
                  </div>
                  <div>{selectedJobModal.user}</div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                    Input Parameters
                  </div>
                  <pre className="bg-muted overflow-x-auto rounded p-4 font-mono text-sm">
                    {JSON.stringify(selectedJobModal.parameters || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end space-x-2">
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download Results
                </Button>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  View Logs
                </Button>
                <Button variant="outline">
                  <Play className="mr-2 h-4 w-4" />
                  Rerun Job
                </Button>
                <Button asChild>
                  <Link href={`/workspace/jobs/${selectedJobModal.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Output
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Main page component with Suspense
export default function JobsV2Page() {
  return (
    <Suspense fallback={<JobsV2LoadingFallback />}>
      <JobsV2Content />
    </Suspense>
  );
}
