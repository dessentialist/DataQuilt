import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, FolderOpen, Save, Eye, Play, Braces, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDevicePicker } from "@/hooks/useDevicePicker";
import type { PromptConfig, PromptTemplate, SystemTemplate } from "@shared/schema";
import { createEmptyUiPrompt, type UiPrompt } from "@/lib/uiPrompts";
import type { FileUploadResponse } from "@/lib/api";
import { getModelsForProvider } from "@shared/llm.models";
import { composeAutocompleteSuggestions } from "@shared/utils";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { MC } from "@/lib/microcopy";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpTip } from "@/components/ui/help-tip";
import { Switch } from "@/components/ui/switch";

// Using shared UiPrompt type from lib/uiPrompts

interface PromptManagerProps {
  prompts: UiPrompt[];
  setPrompts: (prompts: UiPrompt[]) => void;
  onPreview: () => void;
  onStartProcessing: () => void;
  uploadedFile: FileUploadResponse | null;
  isPreviewLoading: boolean;
  isProcessing: boolean;
  hasActiveJob?: boolean;
  skipIfExistingValue?: boolean;
  onToggleSkipIfExisting?: (value: boolean) => void;
}

export function PromptManager({
  prompts,
  setPrompts,
  onPreview,
  onStartProcessing,
  uploadedFile,
  isPreviewLoading,
  isProcessing,
  hasActiveJob = false,
  skipIfExistingValue = false,
  onToggleSkipIfExisting,
}: PromptManagerProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const systemTextareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Templates selection state (loaded on demand when user clicks Load Template)
  const [templates, setTemplates] = useState<PromptTemplate[] | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  // Track which prompt row has its template popover open (null = closed)
  const [openTemplatePopoverFor, setOpenTemplatePopoverFor] = useState<number | null>(null);
  // System templates state mirrors prompt templates UX
  const [systemTemplates, setSystemTemplates] = useState<SystemTemplate[] | null>(null);
  const [isLoadingSystemTemplates, setIsLoadingSystemTemplates] = useState(false);
  const [openSystemTemplatePopoverFor, setOpenSystemTemplatePopoverFor] = useState<number | null>(
    null,
  );
  // Desktop uses Radix Popover anchoring; mobile uses centered modal
  // No manual dropdown position state is needed

  // Fetch templates lazily when opening selector the first time
  const lazyLoadTemplates = async () => {
    if (templates === null && !isLoadingTemplates) {
      try {
        setIsLoadingTemplates(true);
        const res = await api.templates.list();
        const list: PromptTemplate[] = await res.json();
        setTemplates(list || []);
        if (!list || list.length === 0) {
          toast({ title: "No templates", description: "You have no saved templates yet." });
        }
      } catch (error: any) {
        console.error("[PromptManager] Failed to load templates", {
          message: error?.message || String(error),
          code: (error as any)?.code,
          requestId: (error as any)?.requestId,
        });
        const extra =
          error?.code || error?.requestId
            ? ` (code=${error.code ?? "NA"}, req=${error.requestId ?? "NA"})`
            : "";
        toast({
          title: "Load failed",
          description: `Failed to load templates${extra}`.trim(),
          variant: "destructive",
        });
      } finally {
        setIsLoadingTemplates(false);
      }
    }
  };
  const lazyLoadSystemTemplates = async () => {
    if (systemTemplates === null && !isLoadingSystemTemplates) {
      try {
        setIsLoadingSystemTemplates(true);
        let list: SystemTemplate[] = [];
        try {
          const data = await queryClient.fetchQuery<SystemTemplate[] | null>({
            queryKey: ["/api/system-templates"],
          });
          list = (data ?? []) as SystemTemplate[];
        } catch (err: any) {
          console.error("[PromptManager] system-templates fetch error", {
            message: err?.message,
            code: err?.code,
            requestId: err?.requestId,
          });
          throw err;
        }
        setSystemTemplates(list || []);
        if (!list || list.length === 0) {
          toast({
            title: "No system templates",
            description: "You have no saved system templates yet.",
          });
        }
      } catch (error: any) {
        console.error("[PromptManager] Failed to load system templates", {
          message: error?.message || String(error),
          code: (error as any)?.code,
          requestId: (error as any)?.requestId,
        });
        const extra =
          error?.code || error?.requestId
            ? ` (code=${error.code ?? "NA"}, req=${error.requestId ?? "NA"})`
            : "";
        toast({
          title: "Load failed",
          description: `Failed to load system templates${extra}`.trim(),
          variant: "destructive",
        });
      } finally {
        setIsLoadingSystemTemplates(false);
      }
    }
  };
  // Close any open popover when switching between mobile/desktop to avoid mismatched UI
  useEffect(() => {
    if (openTemplatePopoverFor !== null) {
      setOpenTemplatePopoverFor(null);
    }
    if (openSystemTemplatePopoverFor !== null) {
      setOpenSystemTemplatePopoverFor(null);
    }
  }, [isMobile]);

  // Centralized, device-aware pickers
  const templatePicker = useDevicePicker("template");
  const systemPicker = useDevicePicker("system");

  const handleTemplateChosenFor = (templateId: string, index: number) => {
    if (!templates || templates.length === 0) return;
    const chosen = templates.find((t) => t.promptId === templateId);
    if (!chosen) return;
    console.log(
      `[PromptManager] Apply template id=${templateId} name="${chosen.name}" to index=${index}`,
    );
    const updated = [...prompts];
    const current = updated[index];
    if (!current) return;
    updated[index] = {
      ...current,
      // overwrite only the prompt-related fields
      promptText: chosen.promptText,
      outputColumnName: chosen.outputColumnName,
      model: chosen.model,
      // If template has modelId column, use it; otherwise leave undefined so user must pick
      ...((chosen as any).modelId ? { modelId: (chosen as any).modelId } : {}),
    };
    setPrompts(updated);
    // Close popover
    setOpenTemplatePopoverFor(null);
    toast({ title: "Template loaded", description: chosen.name });
  };
  const handleSystemTemplateChosenFor = (systemTemplateId: string, index: number) => {
    if (!systemTemplates || systemTemplates.length === 0) return;
    const chosen = systemTemplates.find((t: any) => t.systemTemplateId === systemTemplateId);
    if (!chosen) return;
    console.log(
      `[PromptManager] Apply system template id=${systemTemplateId} name="${(chosen as any).name}" to index=${index}`,
    );
    const updated = [...prompts];
    const current = updated[index];
    if (!current) return;
    (updated[index] as any) = { ...current, systemText: (chosen as any).systemText };
    setPrompts(updated);
    setOpenSystemTemplatePopoverFor(null);
    toast({ title: "System template loaded", description: (chosen as any).name });
  };

  const availableVariables = uploadedFile?.columnHeaders || [];
  const outputColumns = prompts.map((p) => p.outputColumnName).filter(Boolean);
  const allVariables = Array.from(new Set([...(availableVariables as string[]), ...outputColumns]));

  // Simple inline autocomplete state per-prompt
  // Inline suggestions disabled per UX: we only show variable choices via the Add Variable popover
  const [openAutocompleteFor, setOpenAutocompleteFor] = useState<number | null>(null);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [openSystemVariablePickerFor, setOpenSystemVariablePickerFor] = useState<number | null>(
    null,
  );
  const [openUserVariablePickerFor, setOpenUserVariablePickerFor] = useState<number | null>(null);

  // Autocomplete suggestions from CSV headers and current output columns
  const suggestions = composeAutocompleteSuggestions(
    availableVariables as string[],
    outputColumns,
  ).filter((v) =>
    autocompleteQuery ? v.toLowerCase().startsWith(autocompleteQuery.toLowerCase()) : true,
  );

  const addPrompt = () => {
    const newPrompt = createEmptyUiPrompt();
    console.log("[PromptManager] Add prompt", newPrompt.localId);
    setPrompts([...prompts, newPrompt]);
  };

  const removePrompt = (index: number) => {
    const id = prompts[index]?.localId;
    console.log("[PromptManager] Remove prompt at index", index, "localId", id);
    setPrompts(prompts.filter((_, i) => i !== index));
    // If the removed row had its template popover open, close it and reset position
    setOpenTemplatePopoverFor((prev) => (prev === index ? null : prev));
    // no position state to reset
  };

  const updatePrompt = (index: number, field: keyof PromptConfig, value: string) => {
    const newPrompts = [...prompts];
    newPrompts[index] = { ...newPrompts[index], [field]: value };
    setPrompts(newPrompts);
  };

  const handleTextareaChange = (index: number, value: string) => {
    updatePrompt(index, "promptText", value);
    maybeOpenAutocomplete(index, value);
  };

  const maybeOpenAutocomplete = (_index: number, _value: string) => {
    // Disabled: do nothing to prevent popover opening while typing
    if (openAutocompleteFor !== null) setOpenAutocompleteFor(null);
  };

  const insertVariable = (index: number, variable: string) => {
    const textarea = textareaRefs.current[index];
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    // If cursor is after an unfinished '{{', replace the partial token, else insert a full token
    const before = text.substring(0, start);
    const open = before.lastIndexOf("{{");
    const close = before.lastIndexOf("}}");
    let newBefore = before;
    if (open !== -1 && open > close) {
      newBefore = before.substring(0, open) + "{{" + variable + "}}";
    } else {
      newBefore = before + "{{" + variable + "}}";
    }
    const after = text.substring(end);
    const newText = `${newBefore}${after}`;

    updatePrompt(index, "promptText", newText);

    // Set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPos = newBefore.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);

    setOpenAutocompleteFor(null);
  };
  const insertVariableIntoSystem = (index: number, variable: string) => {
    const textarea = systemTextareaRefs.current[index];
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const open = before.lastIndexOf("{{");
    const close = before.lastIndexOf("}}");
    let newBefore = before;
    if (open !== -1 && open > close) {
      newBefore = before.substring(0, open) + "{{" + variable + "}}";
    } else {
      newBefore = before + "{{" + variable + "}}";
    }
    const after = text.substring(end);
    const newText = `${newBefore}${after}`;
    updatePrompt(index, "systemText" as any, newText);
    setTimeout(() => {
      textarea.focus();
      const newPos = newBefore.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const canPreview =
    uploadedFile &&
    prompts.length > 0 &&
    prompts.every((p) => p.promptText && p.outputColumnName && (p as any).modelId);
  const canProcess = canPreview && !isProcessing;

  const findDuplicateOutputColumns = (): string[] => {
    const counts = new Map<string, number>();
    for (const p of prompts) {
      const name = (p.outputColumnName || "").trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, c]) => c > 1)
      .map(([n]) => n);
  };

  const handlePreviewClick = () => {
    const dups = findDuplicateOutputColumns();
    if (dups.length > 0) {
      console.log("[PromptManager] Duplicate outputColumnName detected for preview:", dups);
      toast({
        title: "Duplicate output columns",
        description: `Each output column must be unique. Duplicates: ${dups.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    onPreview();
  };

  const handleStartClick = () => {
    const dups = findDuplicateOutputColumns();
    if (dups.length > 0) {
      console.log("[PromptManager] Duplicate outputColumnName detected for start:", dups);
      toast({
        title: "Duplicate output columns",
        description: `Each output column must be unique. Duplicates: ${dups.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    onStartProcessing();
  };

  return (
    <div>
      <div>
        <div className="p-4 lg:p-6 space-y-5 lg:space-y-6">
          {prompts.map((promptConfig, index) => (
            <div
              key={promptConfig.localId}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 lg:p-4"
            >
              {/* Mobile: Title with delete button (render only when isMobile to avoid tablet duplication) */}
              {isMobile ? (
                <div className="flex items-center justify-between mb-3">
                  <div className="text-base font-semibold oracle-primary">Prompt {index + 1}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePrompt(index)}
                    data-testid={`button-remove-prompt-${index}`}
                    className="text-gray-500 hover:text-red-500 -mr-2"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ) : null}

              {/* Mobile buttons moved to header rows below */}

              {/* Desktop: Title + delete only (buttons moved above respective fields) */}
              {isMobile ? null : (
                <div className="flex flex-row items-center justify-between gap-3 mb-4">
                  <div className="text-base lg:text-lg font-semibold oracle-primary">Prompt {index + 1}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePrompt(index)}
                    data-testid={`button-remove-prompt-${index}`}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              )}
              {/* Template selector now handled via button-anchored Popover above */}

              <div className="grid grid-cols-1 gap-3 lg:gap-4">
                {/* Expert Role field */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`system-${index}`}>Expert Role</Label>
                      <HelpTip ariaLabel="System Message info" content={MC.dashboard.promptManager.system.tooltip} />
                    </div>
                  </div>
                  <p className="text-xs oracle-muted leading-relaxed mt-0 lg:mt-0 mb-0 lg:mb-0">{MC.dashboard.promptManager.system.subheader}</p>
                  <p className="text-sm oracle-muted leading-relaxed mt-0 lg:mt-0 mb-0 lg:mb-0">{MC.dashboard.promptManager.system.guide}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start mb-3 oracle-mt-controls">
                    {/* Column 1: Add Column Name */}
                    <div className="flex flex-col items-stretch">
                      <Popover
                        open={openSystemVariablePickerFor === index}
                        onOpenChange={(isOpen) => {
                          setOpenSystemVariablePickerFor(isOpen ? index : null);
                          console.log(
                            `[PromptManager] System variable popover`,
                            isOpen ? `open(index=${index})` : "closed",
                          );
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            data-testid={`button-add-system-variable-${index}`}
                            className="h-10 w-full border-oracle-accent text-oracle-accent hover:bg-oracle-accent hover:text-white inline-flex items-center justify-center gap-1"
                          >
                            <Braces size={14} className="mr-1" />
                            <span className="block text-center leading-tight whitespace-normal">Add Column Name</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-56 p-0">
                          <div className="max-h-60 overflow-auto py-1">
                            {suggestions.map((s) => (
                              <div
                                key={s}
                                className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  console.log("[PromptManager] System variable selected", s, "for index", index);
                                  insertVariableIntoSystem(index, s);
                                  setOpenSystemVariablePickerFor(null);
                                }}
                              >
                                {s}
                              </div>
                            ))}
                            {suggestions.length === 0 && (
                              <div className="px-3 py-2 text-sm oracle-muted">No variables available</div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <div className="text-[11px] oracle-muted text-center oracle-mt-micro hidden sm:block">{MC.dashboard.promptManager.system.buttons.addVariable.micro}</div>
                    </div>

                    {/* Column 2: Load Expert */}
                    <div className="flex flex-col items-stretch">
                      {systemPicker.shouldRenderDesktopActions ? (
                        <Popover
                          open={systemPicker.desktop.openIndex === index}
                          onOpenChange={async (isOpen) => {
                            systemPicker.desktop.onOpenChange(index, isOpen);
                            console.log(`[PromptManager] System template popover (desktop)`, isOpen ? `open(index=${index})` : "closed");
                            if (isOpen) await lazyLoadSystemTemplates();
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              stackOnNarrow
                              variant="outline"
                              className="h-10 w-full border-gray-400 text-gray-700 hover:bg-gray-700 hover:text-white inline-flex items-center justify-center gap-1"
                              data-testid={`button-load-system-template-desktop-${index}`}
                              onClick={() => systemPicker.open(index)}
                            >
                              <FolderOpen size={16} className="mr-1" />
                              <span className="block text-center leading-tight whitespace-normal">Load Expert</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-64 p-0 z-50">
                            <div className="max-h-60 overflow-auto py-1">
                              {isLoadingSystemTemplates && (
                                <div className="px-3 py-2 text-sm oracle-muted">Loading system templates...</div>
                              )}
                              {!isLoadingSystemTemplates && (systemTemplates || []).map((t: any) => (
                                <div key={t.systemTemplateId} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); handleSystemTemplateChosenFor(t.systemTemplateId, index); systemPicker.close(); }}>
                                  {t.name}
                                </div>
                              ))}
                              {!isLoadingSystemTemplates && (systemTemplates || []).length === 0 && (
                                <div className="px-3 py-2 text-sm oracle-muted">No system templates found</div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Button
                          stackOnNarrow
                          variant="outline"
                          className="h-10 w-full border-gray-400 text-gray-700 hover:bg-gray-700 hover:text-white inline-flex items-center justify-center gap-1"
                          data-testid={`button-load-system-template-mobile-${index}`}
                          onClick={async () => {
                            setOpenSystemTemplatePopoverFor(index);
                            console.log(`[PromptManager] Mobile system template button clicked for index=${index}`);
                            await lazyLoadSystemTemplates();
                          }}
                        >
                          <FolderOpen size={14} className="mr-1" />
                          <span className="block text-center leading-tight whitespace-normal">Load System</span>
                        </Button>
                      )}
                      <div className="text-[11px] oracle-muted text-center oracle-mt-micro">{MC.dashboard.promptManager.system.buttons.loadSystem.micro}</div>
                    </div>

                    {/* Column 3: Save Expert */}
                    <div className="flex flex-col items-stretch">
                      <Button
                        stackOnNarrow
                        variant="outline"
                        className="h-10 w-full border-gray-400 text-gray-700 hover:bg-gray-700 hover:text-white inline-flex items-center justify-center gap-1"
                        onClick={async () => {
                          try {
                            const name = prompt("System template name?")?.trim();
                            if (!name) return;
                            const currentPrompt = prompts[index];
                            if (!currentPrompt || !(currentPrompt as any).systemText) {
                              toast({ title: "No system message", description: "Add a system message before saving.", variant: "destructive" });
                              return;
                            }
                            const res = await api.systemTemplates.create({ name, systemText: (currentPrompt as any).systemText, userId: "" } as any);
                            await res.json();
                            toast({ title: "System template saved", description: name });
                            if (systemTemplates !== null) {
                              try {
                                const r = await api.systemTemplates.list();
                                const list: SystemTemplate[] = await r.json();
                                setSystemTemplates(list || []);
                              } catch {}
                            }
                          } catch (error) {
                            toast({ title: "Save failed", description: "Failed to save system template", variant: "destructive" });
                          }
                        }}
                        data-testid={`button-save-system-template-${index}`}
                      >
                        <Save size={16} className="mr-1" />
                        Save Expert
                      </Button>
                      <div className="text-[11px] oracle-muted text-center oracle-mt-micro">{MC.dashboard.promptManager.system.buttons.saveSystem.micro}</div>
                    </div>
                  </div>
                  <Textarea
                    ref={(el) => (systemTextareaRefs.current[index] = el)}
                    value={(promptConfig as any).systemText || ""}
                    onChange={(e) => updatePrompt(index, "systemText" as any, e.target.value)}
                    placeholder="Eg: You are an expert cold emailer in {{category}} in {{country}}..."
                    className="min-h-20 resize-none focus:border-oracle-accent"
                    data-testid={`textarea-system-${index}`}
                  />
                </div>

                {/* Task Instructions Text */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`prompt-${index}`}>Task Instructions</Label>
                      <HelpTip ariaLabel="User Message info" content={MC.dashboard.promptManager.user.tooltip} />
                    </div>
                  </div>
                  <p className="text-xs oracle-muted leading-relaxed mt-0 lg:mt-0 mb-0 lg:mb-0">{MC.dashboard.promptManager.user.subheader}</p>
                  <p className="text-sm oracle-muted leading-relaxed mt-0 lg:mt-0 mb-0 lg:mb-0">{MC.dashboard.promptManager.user.guide}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start mb-3 oracle-mt-controls">
                    {/* Column 1: Add Column Name */}
                    <div className="flex flex-col items-stretch">
                      <Popover
                        open={openUserVariablePickerFor === index}
                        onOpenChange={(isOpen) => {
                          setOpenUserVariablePickerFor(isOpen ? index : null);
                          console.log(`[PromptManager] Variable popover`, isOpen ? `open(index=${index})` : "closed");
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            stackOnNarrow
                            variant="outline"
                            data-testid={`button-add-variable-${index}`}
                            className="h-10 w-full border-oracle-accent text-oracle-accent hover:bg-oracle-accent hover:text-white inline-flex items-center justify-center gap-1"
                          >
                            <Braces size={14} className="mr-1" />
                            <span className="block text-center leading-tight whitespace-normal">Add Column Name</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-56 p-0">
                          <div className="max-h-60 overflow-auto py-1">
                            {suggestions.map((s) => (
                              <div key={s} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); console.log("[PromptManager] Variable selected", s, "for index", index); insertVariable(index, s); setOpenUserVariablePickerFor(null); }}>
                                {s}
                              </div>
                            ))}
                            {suggestions.length === 0 && (
                              <div className="px-3 py-2 text-sm oracle-muted">No variables available</div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <div className="text-[11px] oracle-muted text-center oracle-mt-micro hidden sm:block">{MC.dashboard.promptManager.user.buttons.addVariable.micro}</div>
                    </div>

                    {/* Column 2: Load Task */}
                    <div className="flex flex-col items-stretch">
                      {templatePicker.shouldRenderDesktopActions ? (
                        <Popover
                          open={templatePicker.desktop.openIndex === index}
                          onOpenChange={async (isOpen) => {
                            templatePicker.desktop.onOpenChange(index, isOpen);
                            console.log(`[PromptManager] Template popover (desktop)`, isOpen ? `open(index=${index})` : "closed");
                            if (isOpen) await lazyLoadTemplates();
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              stackOnNarrow
                              variant="outline"
                              className="h-10 w-full border-gray-400 text-gray-700 hover:bg-gray-700 hover:text-white"
                              data-testid={`button-load-template-desktop-${index}`}
                              onClick={() => templatePicker.open(index)}
                            >
                              <FolderOpen size={16} className="mr-1" />
                              <span className="block text-center leading-tight whitespace-normal">Load Task</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-64 p-0 z-50">
                            <div className="max-h-60 overflow-auto py-1">
                              {isLoadingTemplates && (<div className="px-3 py-2 text-sm oracle-muted">Loading templates...</div>)}
                              {!isLoadingTemplates && (templates || []).map((t) => (
                                <div key={t.promptId} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); handleTemplateChosenFor(t.promptId, index); templatePicker.close(); }}>
                                  {t.name}
                                </div>
                              ))}
                              {!isLoadingTemplates && (templates || []).length === 0 && (
                                <div className="px-3 py-2 text-sm oracle-muted">No templates found</div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Button
                          stackOnNarrow
                          variant="outline"
                          className="h-10 w-full border-gray-400 text-gray-700 hover:bg-gray-700 hover:text-white"
                          data-testid={`button-load-template-mobile-${index}`}
                          onClick={async () => { setOpenTemplatePopoverFor(index); console.log(`[PromptManager] Mobile template button clicked for index=${index}`); await lazyLoadTemplates(); }}
                        >
                          <FolderOpen size={14} className="mr-1" />
                          <span className="block text-center leading-tight whitespace-normal">Load Task</span>
                        </Button>
                      )}
                      <div className="text-[11px] oracle-muted text-center oracle-mt-micro">{MC.dashboard.promptManager.user.buttons.loadTask.micro}</div>
                    </div>

                    {/* Column 3: Save Task */}
                    <div className="flex flex-col items-stretch">
                      <Button
                        stackOnNarrow
                        variant="outline"
                        className="h-10 w-full border-gray-400 text-gray-700 hover:bg-gray-700 hover:text-white"
                        onClick={async () => {
                          try {
                            const name = prompt("Template name?")?.trim();
                            if (!name) return;
                            const currentPrompt = prompts[index];
                            if (!currentPrompt || !currentPrompt.promptText || !currentPrompt.outputColumnName) {
                              toast({ title: "Incomplete prompt", description: "Fill prompt and output column before saving", variant: "destructive" });
                              return;
                            }
                            const res = await api.templates.create({ name, promptText: currentPrompt.promptText, outputColumnName: currentPrompt.outputColumnName, model: currentPrompt.model, modelId: (currentPrompt as any).modelId } as any);
                            await res.json();
                            toast({ title: "Template saved", description: name });
                            if (templates !== null) {
                              try {
                                const r = await api.templates.list();
                                const list: PromptTemplate[] = await r.json();
                                setTemplates(list || []);
                              } catch { void 0; }
                            }
                          } catch (error) {
                            toast({ title: "Save failed", description: "Failed to save template", variant: "destructive" });
                          }
                        }}
                        data-testid={`button-save-template-${index}`}
                      >
                        <Save size={16} className="mr-1" />
                        <span className="block text-center leading-tight whitespace-normal">Save Task</span>
                      </Button>
                      <div className="text-[11px] oracle-muted text-center oracle-mt-micro">{MC.dashboard.promptManager.user.buttons.saveTask.micro}</div>
                    </div>
                  </div>
                  <Textarea
                    ref={(el) => (textareaRefs.current[index] = el)}
                    value={promptConfig.promptText}
                    onChange={(e) => handleTextareaChange(index, e.target.value)}
                    placeholder="Eg: Write a personalized email to respond to a customer review. Customer Review: {{Customer Review}}, Company Infomration: {{Company Infomration}}..."
                    className="min-h-24 resize-none focus:border-oracle-accent"
                    data-testid={`textarea-prompt-${index}`}
                  />
                </div>

                {/* Mobile: All three fields on same row */}
                <div className="grid grid-cols-3 gap-2 lg:hidden">
                  <div>
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`model-${index}`} className="text-xs">LLM Provider</Label>
                      <HelpTip ariaLabel="Provider info" content={MC.dashboard.promptManager.provider.tooltip} buttonClassName="h-4 w-4" iconClassName="h-3 w-3" />
                    </div>
                    <p className="text-[11px] oracle-muted oracle-mt-subheader">{MC.dashboard.promptManager.provider.subheader}</p>
                    <p className="text-xs oracle-muted oracle-mt-subheader">{MC.dashboard.promptManager.provider.guide}</p>
                    <Select
                      value={promptConfig.model}
                      onValueChange={(value) => updatePrompt(index, "model", value)}
                    >
                      <SelectTrigger data-testid={`select-llm-provider-${index}`}>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="perplexity">Perplexity</SelectItem>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`modelId-${index}`} className="text-xs">Model</Label>
                      <HelpTip ariaLabel="Model info" content={MC.dashboard.promptManager.model.tooltip} buttonClassName="h-4 w-4" iconClassName="h-3 w-3" />
                    </div>
                    <p className="text-[11px] oracle-muted oracle-mt-subheader">{MC.dashboard.promptManager.model.subheader}</p>
                    <p className="text-xs oracle-muted oracle-mt-subheader">{MC.dashboard.promptManager.model.guide}</p>
                    <Select
                      value={(promptConfig as any).modelId || ""}
                      onValueChange={(value) => updatePrompt(index, "modelId" as any, value)}
                    >
                      <SelectTrigger data-testid={`select-model-id-${index}`}>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {getModelsForProvider(promptConfig.model).map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`output-${index}`} className="text-xs">Output Column</Label>
                      <HelpTip ariaLabel="Output column info" content={MC.dashboard.promptManager.output.tooltip} buttonClassName="h-4 w-4" iconClassName="h-3 w-3" />
                    </div>
                    <p className="text-[11px] oracle-muted oracle-mt-subheader">{MC.dashboard.promptManager.output.subheader}</p>
                    <p className="text-xs oracle-muted oracle-mt-subheader">{MC.dashboard.promptManager.output.guide}</p>
                    <Input
                      value={promptConfig.outputColumnName}
                      onChange={(e) => updatePrompt(index, "outputColumnName", e.target.value)}
                      placeholder="e.g., lead_score"
                      className="focus:border-oracle-accent"
                      data-testid={`input-output-column-${index}`}
                    />
                  </div>
                </div>

                {/* Desktop: Original 3-column layout with normal labels */}
                <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4 items-start">
                  <div>
                    <div className="lg:min-h-[88px] mb-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor={`model-${index}`}>LLM Provider</Label>
                        <HelpTip ariaLabel="Provider info" content={MC.dashboard.promptManager.provider.tooltip} />
                      </div>
                      <p className="text-xs oracle-muted oracle-mt-subheader">{MC.dashboard.promptManager.provider.subheader}</p>
                      <p className="text-sm oracle-muted oracle-mt-guide">{MC.dashboard.promptManager.provider.guide}</p>
                    </div>
                    <Select
                      value={promptConfig.model}
                      onValueChange={(value) => updatePrompt(index, "model", value)}
                    >
                      <SelectTrigger data-testid={`select-llm-provider-desktop-${index}`}>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="perplexity">Perplexity</SelectItem>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="lg:min-h-[88px] mb-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor={`modelId-${index}`}>Model</Label>
                        <HelpTip ariaLabel="Model info" content={MC.dashboard.promptManager.model.tooltip} />
                      </div>
                      <p className="text-xs oracle-muted oracle-mt-subheader">{MC.dashboard.promptManager.model.subheader}</p>
                      <p className="text-sm oracle-muted oracle-mt-guide">{MC.dashboard.promptManager.model.guide}</p>
                    </div>
                    <Select
                      value={(promptConfig as any).modelId || ""}
                      onValueChange={(value) => updatePrompt(index, "modelId" as any, value)}
                    >
                      <SelectTrigger data-testid={`select-model-id-desktop-${index}`}>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {getModelsForProvider(promptConfig.model).map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="lg:min-h-[88px] mb-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor={`output-${index}`}>AI Response Column Name</Label>
                        <HelpTip ariaLabel="Output column info" content={MC.dashboard.promptManager.output.tooltip} />
                      </div>
                      <p className="text-xs oracle-muted oracle-mt-subheader">{MC.dashboard.promptManager.output.subheader}</p>
                      <p className="text-sm oracle-muted oracle-mt-guide">{MC.dashboard.promptManager.output.guide}</p>
                    </div>
                    <Input
                      value={promptConfig.outputColumnName}
                      onChange={(e) => updatePrompt(index, "outputColumnName", e.target.value)}
                      placeholder="e.g., lead_score"
                      className="focus:border-oracle-accent"
                      data-testid={`input-output-column-desktop-${index}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Mobile Template Popover - centered modal (render mobile-only) */}
          {isMobile && openTemplatePopoverFor !== null && (
            <div
              className="lg:hidden fixed inset-0 z-50 bg-black/20"
              onClick={() => {
                setOpenTemplatePopoverFor(null);
              }}
            >
              <div
                className="absolute bg-white border rounded-md shadow-lg w-64 p-0 transform -translate-x-1/2"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="max-h-60 overflow-auto py-1">
                  {isLoadingTemplates && (
                    <div className="px-3 py-2 text-sm oracle-muted">Loading templates...</div>
                  )}
                  {!isLoadingTemplates &&
                    (templates || []).map((t) => (
                      <div
                        key={t.promptId}
                        className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                        onClick={() => {
                          handleTemplateChosenFor(t.promptId, openTemplatePopoverFor);
                        }}
                      >
                        {t.name}
                      </div>
                    ))}
                  {!isLoadingTemplates && (templates || []).length === 0 && (
                    <div className="px-3 py-2 text-sm oracle-muted">No templates found</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mobile System Template Popover - centered modal */}
          {isMobile && openSystemTemplatePopoverFor !== null && (
            <div
              className="lg:hidden fixed inset-0 z-50 bg-black/20"
              onClick={() => {
                setOpenSystemTemplatePopoverFor(null);
              }}
            >
              <div
                className="absolute bg-white border rounded-md shadow-lg w-64 p-0 transform -translate-x-1/2"
                style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="max-h-60 overflow-auto py-1">
                  {isLoadingSystemTemplates && (
                    <div className="px-3 py-2 text-sm oracle-muted">
                      Loading system templates...
                    </div>
                  )}
                  {!isLoadingSystemTemplates &&
                    (systemTemplates || []).map((t: any) => (
                      <div
                        key={t.systemTemplateId}
                        className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                        onClick={() => {
                          handleSystemTemplateChosenFor(
                            t.systemTemplateId,
                            openSystemTemplatePopoverFor,
                          );
                        }}
                      >
                        {t.name}
                      </div>
                    ))}
                  {!isLoadingSystemTemplates && (systemTemplates || []).length === 0 && (
                    <div className="px-3 py-2 text-sm oracle-muted">No system templates found</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Desktop: dropdown handled by Radix Popover above; nothing to render here */}
        </div>

        <div className="p-4 lg:p-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={addPrompt}
                variant="outline"
                data-testid="button-add-prompt"
                className="w-full border-2 border-dashed border-gray-300 hover:border-oracle-accent hover:text-oracle-accent"
              >
                <Plus size={16} className="mr-2" />
                Add Another Prompt
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm text-sm">{MC.dashboard.promptManager.addAnotherPrompt.tooltip}</TooltipContent>
          </Tooltip>
          <div className="flex items-center justify-center gap-1 oracle-mt-micro text-xs oracle-muted">
            <span>{MC.dashboard.promptManager.addAnotherPrompt.micro}</span>
            <HelpTip
              ariaLabel="About chaining prompts"
              content={MC.dashboard.promptManager.addAnotherPrompt.info}
              buttonClassName="h-4 w-4"
              iconClassName="h-3 w-3"
            />
          </div>
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="mt-0 mb-12 lg:mb-16">
        <div className="h-px bg-oracle-border mb-4"></div>
        <div className="relative z-10 rounded-lg border border-oracle-border bg-white p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:space-x-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handlePreviewClick}
                disabled={!canPreview || isPreviewLoading}
                variant="outline"
                data-testid="button-preview"
                className="flex-1 border-oracle-accent text-oracle-accent hover:bg-oracle-accent hover:text-white"
              >
                <Eye size={16} className="mr-2" />
                {isPreviewLoading ? "Previewing..." : "PREVIEW"}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm text-sm">{MC.dashboard.previewButton.tooltip}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleStartClick}
                disabled={!canProcess}
                data-testid="button-start-processing"
                className="flex-1 bg-oracle-accent hover:bg-oracle-accent/90 text-white font-semibold"
              >
                <Play size={16} className="mr-2" />
                {isProcessing ? "Processing..." : "START PROCESSING"}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm text-sm">{MC.dashboard.startButton.tooltip}</TooltipContent>
          </Tooltip>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 oracle-mt-micro">
          <div className="text-xs oracle-muted text-center sm:text-left">
            <span className="block">{MC.dashboard.previewButton.subheader}</span>
            <span className="block oracle-mt-subheader">{MC.dashboard.previewButton.micro} {MC.dashboard.previewButton.guide}</span>
          </div>
          <div className="text-xs oracle-muted text-center sm:text-right">
            <span className="block">{MC.dashboard.startButton.subheader}</span>
            <span className="block oracle-mt-subheader">{MC.dashboard.startButton.micro} {MC.dashboard.startButton.guide}</span>
          </div>
        </div>

        {/* Global Skip Toggle integrated into this card */}
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <Switch id="skip-existing-toggle-inline"
              checked={!!skipIfExistingValue}
              onCheckedChange={(v: boolean) => onToggleSkipIfExisting?.(v)}
            />
            <label htmlFor="skip-existing-toggle-inline" className="text-sm font-medium">
              Skip if output exists
            </label>
            <HelpTip ariaLabel="Learn more about Skip if output exists" content={MC.dashboard.global.skipIfExisting.tooltip} />
          </div>
          <p className="oracle-mt-subheader text-xs oracle-muted">{MC.dashboard.global.skipIfExisting.subheader}</p>
          <p className="oracle-mt-guide text-sm oracle-muted">{MC.dashboard.global.skipIfExisting.guide}</p>
        </div>
        </div>
      </div>
    </div>
  );
}
