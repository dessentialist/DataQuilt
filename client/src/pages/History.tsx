import { MainLayout } from "@/components/layout/MainLayout";
import { HistoryTable } from "@/components/history/HistoryTable";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function History() {
  const [location] = useLocation();
  // Read status from the real URL search to support direct loads/new tabs
  const initialStatus = (() => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return params.get("status") || undefined;
    } catch {
      return undefined;
    }
  })();
  // Ensure page opens at the top when navigated to (prevents mid-page landing)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-4xl font-bold oracle-heading mb-2">Enrichment History</h1>
        <p className="text-lg oracle-muted">View and manage your past data enrichment jobs</p>
      </div>

      <HistoryTable initialStatus={initialStatus} />
    </MainLayout>
  );
}
