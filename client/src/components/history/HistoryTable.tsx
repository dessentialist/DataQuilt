import { useEffect, useMemo, useState } from "react";
import { Trash2, Check, X, Clock, AlertCircle, Filter, FileSpreadsheet, Table, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { track, type TelemetryEvent } from "@/lib/telemetry";
import type { EnrichmentJob } from "@shared/schema";
import { useRealtimeJobs } from "@/hooks/useRealtimeJobs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function HistoryTable({ initialStatus }: { initialStatus?: string } = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // applied filter used for fetching; pending filter is controlled by the UI and only applied on button click
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [pendingStatusFilter, setPendingStatusFilter] = useState<string>("");
  // Initialize filters from initialStatus on mount
  useEffect(() => {
    if (initialStatus) {
      setStatusFilter(initialStatus);
      setPendingStatusFilter(initialStatus);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    params.set("limit", "200");
    const qs = params.toString();
    return `/api/history${qs ? `?${qs}` : ""}`;
  }, [statusFilter]);
  const {
    data: jobs,
    isLoading,
    refetch,
  } = useQuery<EnrichmentJob[] | null>({
    queryKey: [url],
  });

  // Subscribe to realtime changes so deletes/updates/creates reflect without refetch
  useRealtimeJobs();

  const deleteMutation = useMutation({
    mutationFn: api.history.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      toast({
        title: "Job deleted",
        description: "The job and its associated files have been deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete job.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDeletingJobId(null);
    },
  });

  const handleDelete = async (jobId: string) => {
    setDeletingJobId(jobId);
    deleteMutation.mutate(jobId);
  };

  const handleDownload = async (jobId: string) => {
    try {
      const response = await api.jobs.downloadUrl(jobId);
      const { url } = await response.json();
      window.open(url, "_blank");
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to generate download link.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadLogs = async (jobId: string) => {
    try {
      const response = await api.jobs.logsUrl(jobId);
      const { url } = await response.json();
      window.open(url, "_blank");
    } catch (error) {
      toast({
        title: "Logs download failed",
        description: "Failed to generate logs link.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadOriginal = async (fileId: string) => {
    try {
      const response = await api.files.downloadUrlById(fileId);
      const { url, requestId } = await response.json();
      track("download_original_success", { fileId, requestId });
      window.open(url, "_blank");
    } catch (error) {
      toast({
        title: "Original download failed",
        description: "Failed to generate original file link.",
        variant: "destructive",
      });
      track("download_original_error", {
        fileId,
        message: String((error as any)?.message || error),
        code: (error as any)?.code,
        requestId: (error as any)?.requestId,
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Check className="text-green-600" size={16} />;
      case "failed":
        return <X className="text-red-600" size={16} />;
      case "processing":
      case "queued":
        return <Clock className="text-blue-600" size={16} />;
      case "paused":
        return <AlertCircle className="text-yellow-600" size={16} />;
      default:
        return <AlertCircle className="text-gray-600" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100";
      case "failed":
        return "bg-red-100";
      case "processing":
      case "queued":
        return "bg-blue-100";
      case "paused":
        return "bg-yellow-100";
      default:
        return "bg-gray-100";
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Filter size={16} className="oracle-muted" />
          <select
            className="border rounded px-2 py-1 text-sm oracle-muted"
            value={pendingStatusFilter}
            onChange={(e) => {
              const value = e.target.value;
              setPendingStatusFilter(value);
              track("history_filter_changed" as TelemetryEvent, { status: value });
            }}
          >
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="paused">Paused</option>
            <option value="stopped">Stopped</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              track("history_filter_applied" as TelemetryEvent, { status: statusFilter || "all" });
              setStatusFilter(pendingStatusFilter);
            }}
          >
            Apply
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-center oracle-muted">Loading history...</div>
        ) : !jobs || (Array.isArray(jobs) && jobs.length === 0) ? (
          <div className="p-6 text-center oracle-muted">
            No enrichment jobs found. Upload a CSV and start processing to see your history here.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium oracle-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium oracle-muted uppercase tracking-wider">
                  File
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium oracle-muted uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium oracle-muted uppercase tracking-wider">
                  Created
                </th>
              <th className="px-6 py-3 text-center text-xs font-medium oracle-muted uppercase tracking-wider">
                  Original
                </th>
              <th className="px-6 py-3 text-center text-xs font-medium oracle-muted uppercase tracking-wider">
                  Enriched
                </th>
              <th className="px-6 py-3 text-center text-xs font-medium oracle-muted uppercase tracking-wider">
                  Logs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium oracle-muted uppercase tracking-wider">
                  Delete
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(jobs as EnrichmentJob[]).map((job: EnrichmentJob) => (
                <tr key={job.jobId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div
                      className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full ${getStatusColor(job.status)}`}
                    >
                      {getStatusIcon(job.status)}
                      <span className="text-sm font-medium capitalize">{job.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium oracle-primary">
                      {(job as any).originalName || job.fileId}
                    </div>
                    <div className="text-sm oracle-muted">{job.totalRows.toLocaleString()} rows</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm oracle-primary">
                      {job.rowsProcessed} / {job.totalRows}
                    </div>
                    <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-oracle-accent h-2 rounded-full transition-all"
                        style={{
                          width: `${job.totalRows > 0 ? Math.round((job.rowsProcessed / job.totalRows) * 100) : 0}%`,
                        }}
                      ></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm oracle-muted">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadOriginal(job.fileId)}
                      className="text-gray-600 hover:text-gray-900"
                      title="Download original CSV"
                    >
                    <FileSpreadsheet size={16} />
                    </Button>
                  </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(job.jobId)}
                      className="text-oracle-accent hover:text-oracle-accent/80"
                      title="Download enriched CSV"
                    >
                    <Table size={16} />
                    </Button>
                  </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadLogs(job.jobId)}
                      className="text-gray-600 hover:text-gray-900"
                      title="Download logs (TXT)"
                    >
                    <ScrollText size={16} />
                    </Button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingJobId === job.jobId}
                          className="text-gray-500 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete job permanently?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the job, its logs, and delete both the original and
                            enriched files from storage. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(job.jobId)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
