import { useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { EnrichmentJob, JobLog } from "@shared/schema";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Subscribes to realtime updates for a specific job using best practices.
 * - Streams UPDATEs from `public.enrichment_jobs` for the given job_id
 * - Streams INSERTs from `public.job_logs` for the given job_id
 * - Handles React Strict Mode properly to avoid double subscriptions
 * - Uses ref-based subscription management for reliability
 * - Returns connection state for UI indicator
 */
export function useRealtimeJob(jobId: string | null) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Guard to prevent overlapping subscription setup (e.g., Strict Mode double-invocation)
  const isSubscribingRef = useRef(false);

  useEffect(() => {
    // Clear any existing subscription first with proper cleanup
    if (channelRef.current) {
      console.log("[RT] Cleaning up existing channel");
      try {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
      } catch (error) {
        console.warn("[RT] Error during channel cleanup:", error);
      }
      channelRef.current = null;
    }

    // Reset state
    setIsConnected(false);
    setLastError(null);

    if (!jobId) {
      console.log("[RT] No jobId provided, skipping subscription");
      return;
    }

    // Idempotent guard: avoid parallel setup for the same jobId
    if (isSubscribingRef.current) {
      console.warn("[RT] Subscription setup already in progress - skipping duplicate setup for job:", jobId);
      return;
    }
    isSubscribingRef.current = true;
    console.log("[RT] Setting up subscription for job:", jobId);

    // Get session and setup channel
    const setupSubscription = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("[RT] Auth error:", error);
          setLastError("auth_error");
          return;
        }

        if (!session) {
          console.warn("[RT] No active session found");
          setLastError("unauthenticated");
          return;
        }

        console.log("[RT] Session found, creating channel for job:", jobId);

        // Create the channel with a unique name
        const channel = supabase
          .channel(`realtime-job-${jobId}`, {
            config: {
              presence: { key: jobId },
            },
          })
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "enrichment_jobs",
              filter: `job_id=eq.${jobId}`,
            },
            (payload) => {
              // Raw Supabase payload uses snake_case column names, need to map to camelCase
              const rawJob = payload.new as any;
              const updatedJob: EnrichmentJob = {
                jobId: rawJob.job_id,
                userId: rawJob.user_id,
                fileId: rawJob.file_id,
                status: rawJob.status,
                promptsConfig: rawJob.prompts_config,
                totalRows: rawJob.total_rows,
                rowsProcessed: rawJob.rows_processed,
                currentRow: rawJob.current_row,
                enrichedFilePath: rawJob.enriched_file_path,
                leaseExpiresAt: rawJob.lease_expires_at,
                createdAt: rawJob.created_at,
                finishedAt: rawJob.finished_at,
                errorMessage: rawJob.error_message,
                errorDetails: rawJob.error_details,
              };
              
              console.log("[RT] Job update received:", {
                jobId: updatedJob.jobId,
                status: updatedJob.status,
                progress: `${updatedJob.rowsProcessed}/${updatedJob.totalRows}`,
              });

              // Update cache directly with real-time data - no need to invalidate since we have fresh data
              queryClient.setQueryData([`/api/jobs/${jobId}`], (oldData: any) => {
                if (!oldData) return { job: updatedJob, logs: [] };
                return {
                  ...oldData,
                  job: updatedJob,
                };
              });
              
              console.log("[RT] Job cache updated via real-time event", {
                jobId: updatedJob.jobId,
                status: updatedJob.status,
                skipRefetch: "using_realtime_data"
              });
            },
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "job_logs",
              filter: `job_id=eq.${jobId}`,
            },
            (payload) => {
              // Raw Supabase payload uses snake_case column names, need to map to camelCase
              const rawLog = payload.new as any;
              const newLog: JobLog = {
                logId: rawLog.log_id,
                jobId: rawLog.job_id,
                level: rawLog.level,
                message: rawLog.message,
                timestamp: rawLog.timestamp,
              };
              
              console.log("[RT] Log insert received:", {
                level: newLog.level,
                message: newLog.message,
              });

              // Update cache directly with real-time log data - no need to invalidate since we have fresh data
              queryClient.setQueryData([`/api/jobs/${jobId}`], (oldData: any) => {
                if (!oldData) return { job: null, logs: [newLog] };
                return {
                  ...oldData,
                  logs: [...(oldData.logs || []), newLog],
                };
              });
              
              console.log("[RT] Logs cache updated via real-time event", {
                logLevel: newLog.level,
                skipRefetch: "using_realtime_data"
              });
            },
          )
          .subscribe((status, error) => {
            console.log("[RT] Subscription status changed:", { status, error, jobId });

            setIsConnected(status === "SUBSCRIBED");

            if (status === "SUBSCRIBED") {
              // Release idempotent guard on success
              isSubscribingRef.current = false;
              console.log("[RT] Successfully subscribed to job updates");
              setLastError(null);
              // Ensure we hydrate with latest job + logs immediately in case
              // subscription started after some events were emitted
              queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
            } else if (status === "CHANNEL_ERROR") {
              console.error("[RT] Channel error:", error);
              setLastError("channel_error");
              // Release guard on terminal/error states
              isSubscribingRef.current = false;
            } else if (status === "TIMED_OUT") {
              console.warn("[RT] Connection timed out - this may be an intermittent network issue");
              setLastError("timeout");
              // Release guard so caller can retry via effect on re-render
              isSubscribingRef.current = false;
            } else if (status === "CLOSED") {
              console.warn("[RT] Channel closed");
              setLastError("closed");
              // Final refresh to capture any last logs written just before close
              queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
              // Release guard on close
              isSubscribingRef.current = false;
            }
          });

        // Store the channel reference
        channelRef.current = channel;
      } catch (error) {
        console.error("[RT] Failed to setup subscription:", error);
        setLastError("setup_error");
        // Release guard on setup failure
        isSubscribingRef.current = false;
      }
    };

    // Setup the subscription
    setupSubscription();

    // Cleanup function with proper unsubscribe
    return () => {
      console.log("[RT] Cleaning up subscription for job:", jobId);
      // Always release guard on effect cleanup so future setups can proceed
      isSubscribingRef.current = false;
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.warn("[RT] Error during subscription cleanup:", error);
        }
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [jobId, queryClient]); // Remove handler deps to avoid stale closures

  return { isConnected, lastError };
}
