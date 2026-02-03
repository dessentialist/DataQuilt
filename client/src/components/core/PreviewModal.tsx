import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PreviewResponse } from "@/lib/api";
import type { PromptConfig } from "@shared/schema";
import { extractVariables, substituteVariablesInMessages } from "@shared/utils";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: PreviewResponse | null;
  onProceedWithJob: () => void;
  isLoading: boolean;
  promptsConfig?: PromptConfig[];
  inputHeaders?: string[];
}

export function PreviewModal({
  isOpen,
  onClose,
  previewData,
  onProceedWithJob,
  isLoading,
  promptsConfig,
  inputHeaders,
}: PreviewModalProps) {
  // If no data at all, render nothing
  if (!previewData) return null;

  // Prefer server-provided 'detailed'; otherwise, derive a compatible structure on the client
  const rows =
    (previewData as any).detailed && Array.isArray((previewData as any).detailed)
      ? (previewData as any).detailed
      : (() => {
          if (!previewData.previewData || previewData.previewData.length === 0) {
            return [];
          }
          const prompts = (promptsConfig || []) as PromptConfig[];
          return previewData.previewData.slice(0, 2).map((enriched) => {
            const original: Record<string, any> = {};
            // Build original subset from known CSV headers when available
            (inputHeaders || Object.keys(enriched || {})).forEach((h) => {
              if (h in enriched) original[h] = (enriched as any)[h];
            });
            const promptDetails = prompts.map((p, idx) => {
              const usedVariables = Array.from(
                new Set([
                  ...extractVariables((p as any).systemText || ""),
                  ...extractVariables(p.promptText || ""),
                ]),
              );
              const { systemProcessed, userProcessed } = substituteVariablesInMessages(
                (p as any).systemText,
                p.promptText,
                enriched,
              );
              return {
                index: idx,
                model: p.model,
                modelId: (p as any).modelId,
                outputColumnName: p.outputColumnName,
                usedVariables,
                systemProcessed,
                userProcessed,
                response: String((enriched as any)[p.outputColumnName] ?? ""),
                skipped: false,
              };
            });
            return { original, enriched, prompts: promptDetails };
          });
        })();

  if (!rows || rows.length === 0) return null;

  // meta retained for timestamp/models display either way
  const meta: any = (previewData as any).meta;
  const allOutputNames = new Set<string>(
    (promptsConfig || []).map((p) => p.outputColumnName).filter(Boolean),
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] px-6 py-5 sm:px-8 sm:py-6 pb-12">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Preview Results</DialogTitle>
        </DialogHeader>

        <div className="text-sm oracle-muted mb-3 flex items-center gap-2">
          <Info size={14} />
          Showing real model responses for the first 2 rows
          {meta?.timestamp && (
            <span className="ml-2">
              at {new Date(meta.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        

        <Tabs defaultValue="row-0" className="w-full">
          <TabsList className="mb-5 gap-2">
            {rows.map((_, idx) => (
              <TabsTrigger
                key={idx}
                value={`row-${idx}`}
                className="px-3 py-1.5 text-sm"
              >
                Row {idx + 1}
              </TabsTrigger>
            ))}
          </TabsList>

          {rows.map((row, idx) => {
            const allUsed = Array.from(
              new Set(row.prompts.flatMap((p) => p.usedVariables || [])),
            );
            // Build display pairs: label, value, origin
            const kvPairs = allUsed.map((name) => {
              const isAiOutput = allOutputNames.has(name);
              const value =
                row.enriched[name] ??
                row.original[name] ??
                ""; // prefer enriched to include chained outputs
              return { name, value: String(value ?? "") };
            });
            return (
              <TabsContent key={idx} value={`row-${idx}`}>
                <ScrollArea className="max-h-[64vh] pr-2">
                  <div className="space-y-7">
                    <section>
                      <h3 className="text-base font-semibold mb-3 text-gray-900">Original Data</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium oracle-muted uppercase w-56">
                                Column Name
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium oracle-muted uppercase">
                                Value
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {kvPairs.map((kv) => (
                              <tr key={kv.name}>
                                <td className="px-3 py-2 text-sm">
                                  <div className="text-sm">{kv.name}</div>
                                </td>
                                <td className="px-3 py-2 text-sm leading-relaxed">
                                  <div className="truncate" title={kv.value}>
                                    {kv.value}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <Separator />

                    <section>
                      <h3 className="text-base font-semibold mb-3 text-gray-900">AI Response (Structured)</h3>
                      <Accordion
                        type="multiple"
                        defaultValue={row.prompts.map((_, i) => `p-${i}`)}
                        className="w-full"
                      >
                        {row.prompts.map((p, pIdx) => (
                          <AccordionItem key={pIdx} value={`p-${pIdx}`}>
                            <AccordionTrigger>
                              <div className="text-left">
                                <div className="text-base font-medium text-gray-900">
                                  Prompt {pIdx + 1} — {p.outputColumnName}
                                </div>
                                <div className="text-xs oracle-muted mt-0.5">
                                  {p.model} {p.modelId ? `· ${p.modelId}` : ""}
                                  {p.skipped ? " · Skipped due to existing value" : ""}
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-4">
                                <div>
                                  <div className="text-xs oracle-muted mb-1.5">Expert Role</div>
                                  <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-gray-50 rounded p-3 border border-gray-200">
                                    {p.systemProcessed || "(none)"}
                                  </pre>
                                </div>
                                <div>
                                  <div className="text-xs oracle-muted mb-1.5">Task Instructions</div>
                                  <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-gray-50 rounded p-3 border border-gray-200">
                                    {p.userProcessed || ""}
                                  </pre>
                                </div>
                                <div>
                                  <div className="text-xs oracle-muted mb-1.5">{p.outputColumnName || "LLM Response"}</div>
                                  <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-purple-25 rounded p-3 border border-purple-100">
                                    {String(p.response ?? "")}
                                  </pre>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </section>
                  </div>
                </ScrollArea>
              </TabsContent>
            );
          })}
        </Tabs>

        <div className="flex justify-end space-x-3 mt-4">
          <Button stackOnNarrow size="compact"
            variant="outline"
            onClick={onClose}
            className="border-oracle-accent text-oracle-accent hover:bg-oracle-accent hover:text-white"
          >
            Close Preview
          </Button>
          <Button stackOnNarrow size="compact"
            onClick={onProceedWithJob}
            disabled={isLoading}
            className="bg-oracle-accent hover:bg-oracle-accent/90 text-white"
          >
            {isLoading ? "Starting..." : "Proceed with Full Processing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
