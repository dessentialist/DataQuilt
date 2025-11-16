import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import type { EnrichmentJob } from "@shared/schema";

/**
 * Subscribes to realtime changes for enrichment_jobs and updates React Query caches in place
 * so the History view updates without an explicit refetch after inserts/updates/deletes.
 *
 * Scope: per-user visibility is enforced by RLS on Supabase; the channel receives only the
 * caller's rows as configured in Phase 6.
 */
export function useRealtimeJobs() {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("jobs-history")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "enrichment_jobs",
        },
        (payload) => {
          const newJob = payload.new as EnrichmentJob;
          // Update any history queries (by URL) in cache: prepend new row
          queryClient.setQueriesData<EnrichmentJob[]>(
            { queryKey: ["/api/history"], exact: false },
            (old) => {
              if (!old) return old;
              // Avoid duplicates
              if (old.some((j) => j.jobId === newJob.jobId)) return old;
              return [newJob, ...old];
            },
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "enrichment_jobs",
        },
        (payload) => {
          const updated = payload.new as EnrichmentJob;
          queryClient.setQueriesData<EnrichmentJob[]>(
            { queryKey: ["/api/history"], exact: false },
            (old) => {
              if (!old) return old;
              return old.map((j) => (j.jobId === updated.jobId ? { ...j, ...updated } : j));
            },
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "enrichment_jobs",
        },
        (payload) => {
          const removed = payload.old as EnrichmentJob;
          queryClient.setQueriesData<EnrichmentJob[]>(
            { queryKey: ["/api/history"], exact: false },
            (old) => {
              if (!old) return old;
              return old.filter((j) => j.jobId !== removed.jobId);
            },
          );
        },
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);
}
