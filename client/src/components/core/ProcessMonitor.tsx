import { useState, useEffect, useMemo } from "react";
import { Pause, Play, Square, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { EnrichmentJob, JobLog } from "@shared/schema";
import { track } from "@/lib/telemetry";
import { MC } from "@/lib/microcopy";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpTip } from "@/components/ui/help-tip";
import { JobErrorModal } from "./JobErrorModal";

interface ProcessMonitorProps {
  jobData: { job: EnrichmentJob; logs: JobLog[] } | null;
  isLoading: boolean;
  jobId: string | null; // Stable jobId to prevent subscription churn during refetches
}

export function ProcessMonitor({ jobData, isLoading, jobId }: ProcessMonitorProps) {
  const [controlLoading, setControlLoading] = useState<string | null>(null);
  const { toast } = useToast();
  // Auto-scroll removed: we intentionally avoid forcing the view to follow logs

  const job = jobData?.job || null;
  const logs = useMemo(() => jobData?.logs ?? [], [jobData?.logs]);

  // Error modal state - prevent duplicate opens
  const [errorModalShown, setErrorModalShown] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

  // Detect paused job with error details and show modal
  useEffect(() => {
    const hasError = job?.status === "paused" && job?.errorDetails;
    
    if (hasError && !errorModalShown) {
      // Job is paused with error - show modal
      setErrorModalShown(true);
      setIsErrorModalOpen(true);
    } else if (job?.status !== "paused") {
      // Job resumed/stopped/completed - reset modal state
      setErrorModalShown(false);
      setIsErrorModalOpen(false);
    }
  }, [job?.status, job?.errorDetails, errorModalShown]);

  // Extract dedupe summary metrics from logs when job completes
  const summary = useMemo(() => {
    if (!logs || logs.length === 0) return null as null | {
      totalPlanned: number;
      callsMade: number;
      avoided: number;
      uniqueKeys: number;
      savingsPct: string;
    };
    for (let i = logs.length - 1; i >= 0; i -= 1) {
      const msg = logs[i]?.message || "";
      if (typeof msg === "string" && msg.startsWith("DEDUPE_SUMMARY ")) {
        const m = msg.match(/total_planned=(\d+)\s+llm_calls_made=(\d+)\s+avoided_llm_calls=(\d+)\s+unique_keys=(\d+)\s+savings_pct=([0-9.]+)/);
        if (m) {
          return {
            totalPlanned: Number(m[1] || 0),
            callsMade: Number(m[2] || 0),
            avoided: Number(m[3] || 0),
            uniqueKeys: Number(m[4] || 0),
            savingsPct: String(m[5] || "0.0"),
          };
        }
      }
    }
    return null;
  }, [logs]);

  // Log current job context (subscription handled at Dashboard level)
  console.log("[ProcessMonitor] Context:", {
    stableJobId: jobId,
    derivedJobId: job?.jobId || null,
    hasJobData: !!jobData,
  });

  // Auto-scroll removed: keep user scroll position stable during log updates

  const handleJobControl = async (command: "pause" | "resume" | "stop") => {
    if (!job || !job.jobId) {
      console.error("[ProcessMonitor] Cannot control job: missing job or jobId", { job, jobId });
      toast({
        title: "Error",
        description: "Cannot control job: invalid job data.",
        variant: "destructive",
      });
      return;
    }

    setControlLoading(command);
    try {
      console.log(`[ProcessMonitor] Sending ${command} command for job:`, job.jobId);
      await api.jobs.control(job.jobId, { command });
      toast({
        title: "Job updated",
        description: `Job ${command}${command === "stop" ? "ped" : "d"} successfully.`,
      });
      track("job_control", { jobId: job.jobId, command });
    } catch (error) {
      console.error(`[ProcessMonitor] Failed to ${command} job:`, error);
      toast({
        title: "Error",
        description: `Failed to ${command} job.`,
        variant: "destructive",
      });
      track("job_control_error", {
        jobId: job.jobId,
        command,
        message: String((error as any)?.message || error),
        code: (error as any)?.code,
        requestId: (error as any)?.requestId,
      });
    } finally {
      setControlLoading(null);
    }
  };

  // Error modal handlers
  const handleErrorResume = async () => {
    if (!job?.jobId) return;
    await handleJobControl("resume");
    setIsErrorModalOpen(false);
  };

  const handleErrorStop = async () => {
    if (!job?.jobId) return;
    await handleJobControl("stop");
    setIsErrorModalOpen(false);
  };

  const handleErrorDismiss = () => {
    setIsErrorModalOpen(false);
    // Don't reset errorModalShown - keep it true so modal doesn't reopen
    // until job status changes
  };

  const handleDownload = async () => {
    if (!job) return;

    try {
      const response = await api.jobs.downloadUrl(job.jobId);
      const { url, requestId } = await response.json();
      track("download_success", { jobId: job.jobId, requestId });
      window.open(url, "_blank");
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to generate download link.",
        variant: "destructive",
      });
      track("download_error", {
        jobId: job.jobId,
        message: String((error as any)?.message || error),
        code: (error as any)?.code,
        requestId: (error as any)?.requestId,
      });
    }
  };

  if (isLoading || !job) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg lg:text-xl oracle-heading">Process Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {isLoading ? "Loading job data..." : "No active job"}
            {!isLoading && !job && (
              <div className="text-xs mt-2 text-destructive">
                If you just started a job, please wait a moment or refresh the page
              </div>
            )}
          </div>

          {/* Job Summary (shows after completion if metrics available) */}
          {job?.status === "completed" && summary && (
            <div className="bg-muted border border-border rounded-lg p-3 lg:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium oracle-primary">Job Summary</span>
                <span className="text-xs oracle-muted">Deterministic dedupe</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="p-2 bg-card border border-border rounded">
                  <div className="text-xs text-muted-foreground">Total Requests Planned</div>
                  <div className="font-semibold">{summary.totalPlanned.toLocaleString()}</div>
                </div>
                <div className="p-2 bg-card border border-border rounded">
                  <div className="text-xs text-muted-foreground">Actual LLM Calls</div>
                  <div className="font-semibold">{summary.callsMade.toLocaleString()}</div>
                </div>
                <div className="p-2 bg-card border border-border rounded">
                  <div className="text-xs text-muted-foreground">LLM Calls Avoided</div>
                  <div className="font-semibold text-green-700">{summary.avoided.toLocaleString()}</div>
                </div>
                <div className="p-2 bg-card border border-border rounded">
                  <div className="text-xs text-muted-foreground">Savings</div>
                  <div className="font-semibold text-green-700">{summary.savingsPct}%</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const progressPercentage =
    job.totalRows > 0 ? Math.round((job.rowsProcessed / job.totalRows) * 100) : 0;
  const nowProcessingRow = typeof (job as any).currentRow === "number" ? (job as any).currentRow : null;
  const isActive = job.status === "processing" || job.status === "queued";
  const isPaused = job.status === "paused";
  // const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";

  const getStatusColor = () => {
    switch (job.status) {
      case "processing":
        return "bg-green-500";
      case "paused":
        return "bg-yellow-500";
      case "completed":
        return "bg-blue-500";
      case "failed":
        return "bg-red-500";
      case "stopped":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case "processing":
        return "Processing";
      case "paused":
        return "Paused";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "stopped":
        return "Stopped - Download Available";
      default:
        return "Queued";
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm">
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        {/* Progress Section */}
        <div className="bg-muted border border-border rounded-lg p-3 lg:p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium oracle-primary">Progress</span>
            <span className="text-sm text-muted-foreground" data-testid="text-progress-stats">
              {(job.rowsProcessed || 0).toLocaleString()} / {(job.totalRows || 0).toLocaleString()}{" "}
              rows ({progressPercentage}%)
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" data-testid="progress-bar" />
          {job.status === "processing" && nowProcessingRow && (
            <div className="text-xs text-muted-foreground mt-2" data-testid="text-now-processing">
              Now processing row {nowProcessingRow.toLocaleString()} of {(job.totalRows || 0).toLocaleString()}
            </div>
          )}
        </div>

        {/* Job Controls */}
        <div className="flex flex-wrap gap-2 lg:gap-3">
          {isPaused ? (
            <Button stackOnNarrow size="compact" variant="default"
              onClick={() => handleJobControl("resume")}
              disabled={controlLoading === "resume"}
              data-testid="button-resume"
            >
              <Play size={16} className="mr-1" />
              {controlLoading === "resume" ? "Resuming..." : "Resume"}
            </Button>
          ) : (
            <Button stackOnNarrow size="compact" variant="outline"
              onClick={() => handleJobControl("pause")}
              disabled={!isActive || controlLoading === "pause"}
              data-testid="button-pause"
            >
              <Pause size={16} className="mr-1" />
              {controlLoading === "pause" ? "Pausing..." : "Pause"}
            </Button>
          )}

          <Button stackOnNarrow size="compact" variant="destructive"
            onClick={() => handleJobControl("stop")}
            disabled={(!isActive && !isPaused) || controlLoading === "stop"}
            data-testid="button-stop"
          >
            <Square size={16} className="mr-1" />
            {controlLoading === "stop" ? "Stopping..." : "Stop"}
          </Button>

          <Button stackOnNarrow size="compact" variant="secondary"
            onClick={handleDownload}
            data-testid="button-download"
          >
            <Download size={16} className="mr-1" />
            Download
          </Button>
        </div>

        {/* Console Logs */}
        <div className="bg-muted border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-medium oracle-primary">Console Logs</h3>
          </div>
          <ScrollArea className="h-48 rounded-b-lg">
            <div className="console-log p-4 text-xs md:text-sm font-mono bg-zinc-950 text-zinc-100 rounded-b-lg" data-testid="console-logs">
              <div className="space-y-1">
                {logs.length === 0 ? (
                  <div className="text-zinc-400">No logs yet...</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={log.logId || index}>
                      <span className="timestamp text-zinc-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
                      <span
                        className={
                          log.level === "ERROR"
                            ? "text-red-400 font-semibold"
                            : log.level === "WARN"
                              ? "text-amber-300"
                              : "text-emerald-300"
                        }
                      >
                        {log.level}
                      </span>{" "}
                      <span className="align-middle">{log.message}</span>
                    </div>
                  ))
                )}
                {/* Auto-scroll sentinel removed */}
              </div>
            </div>
          </ScrollArea>
        </div>

        {isFailed && job.errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg" data-testid="error-message">
            <div className="text-sm font-medium text-red-800">Error:</div>
            <div className="text-sm text-red-600">{job.errorMessage}</div>
          </div>
        )}
      </div>

      {/* Error Modal */}
      {job && (
        <JobErrorModal
          isOpen={isErrorModalOpen}
          onClose={handleErrorDismiss}
          errorDetails={job.errorDetails}
          onResume={handleErrorResume}
          onStop={handleErrorStop}
          isLoading={controlLoading !== null}
        />
      )}
    </div>
  );
}
