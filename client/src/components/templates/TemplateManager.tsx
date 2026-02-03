import { useState } from "react";
import { Plus, Edit, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { PromptTemplate, InsertPromptTemplate, SystemTemplate, InsertSystemTemplate } from "@shared/schema";
import { getModelsForProvider, getModelDisplayName } from "@shared/llm.models";
import { MC } from "@/lib/microcopy";

export function TemplateManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [formData, setFormData] = useState<InsertPromptTemplate & { modelId?: string }>({
    userId: "",
    name: "",
    promptText: "",
    model: "openai",
    outputColumnName: "",
    modelId: undefined,
  });

  const { data: templates, isLoading } = useQuery<PromptTemplate[] | null>({
    queryKey: ["/api/templates"],
  });

  const { data: systemTemplates } = useQuery<SystemTemplate[] | null>({
    queryKey: ["/api/system-templates"],
  });

  const [activeTab, setActiveTab] = useState<"Tasks" | "Role">("Tasks");

  const createMutation = useMutation({
    mutationFn: api.templates.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template saved",
        description: "Your Task Instructions have been saved successfully.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save template.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      templateId,
      data,
    }: {
      templateId: string;
      data: Partial<InsertPromptTemplate>;
    }) => api.templates.update(templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template updated",
        description: "Your task instructions has been updated successfully.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update template.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.templates.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template deleted",
        description: "The template has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template.",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (template?: PromptTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        userId: template.userId,
        name: template.name,
        promptText: template.promptText,
        model: template.model,
        outputColumnName: template.outputColumnName,
        modelId: (template as any).modelId,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        userId: "",
        name: "",
        promptText: "",
        model: "openai",
        outputColumnName: "",
        modelId: undefined,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({
      userId: "",
      name: "",
      promptText: "",
      model: "openai",
      outputColumnName: "",
      modelId: undefined,
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.promptText || !formData.outputColumnName || !formData.modelId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields, including model.",
        variant: "destructive",
      });
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({
        templateId: editingTemplate.promptId,
        data: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (templateId: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteMutation.mutate(templateId);
    }
  };

  const sysCreate = useMutation({
    mutationFn: api.systemTemplates.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-templates"] });
      toast({ title: "Expert Role saved", description: "Your Role has been saved." });
      setSysDialogOpen(false);
      setSysForm({ userId: "", name: "", systemText: "" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save Role.", variant: "destructive" }),
  });

  const sysUpdate = useMutation({
    mutationFn: ({ systemTemplateId, data }: { systemTemplateId: string; data: Partial<InsertSystemTemplate> }) => api.systemTemplates.update(systemTemplateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-templates"] });
      toast({ title: "Expert Role updated", description: "Your expert role has been updated." });
      setSysDialogOpen(false);
      setEditingSystem(null);
      setSysForm({ userId: "", name: "", systemText: "" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update expert role.", variant: "destructive" }),
  });

  const sysDelete = useMutation({
    mutationFn: api.systemTemplates.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-templates"] });
      toast({ title: "Expert role deleted", description: "The expert role has been deleted." });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete expert role.", variant: "destructive" }),
  });

  const [isSysDialogOpen, setSysDialogOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemTemplate | null>(null);
  const [sysForm, setSysForm] = useState<InsertSystemTemplate>({ userId: "", name: "", systemText: "" });

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="text-center py-8">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-sm">
          <button className={`px-3 py-1 rounded ${activeTab === "Tasks" ? "bg-oracle-accent text-white" : "bg-gray-100"}`} onClick={() => setActiveTab("Tasks")}>{MC.templatesPage.tabs.tasks}</button>
          <button className={`px-3 py-1 rounded ${activeTab === "Role" ? "bg-oracle-accent text-white" : "bg-gray-100"}`} onClick={() => setActiveTab("Role")}>{MC.templatesPage.tabs.roles}</button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenDialog()}
                variant="outline"
                className="hover:bg-oracle-accent hover:text-white hover:border-oracle-accent"
              >
                <Plus size={16} className="mr-2" />
                {MC.templatesPage.buttons.newTask.label}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create New Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Lead Scoring Template"
                />
              </div>
              <div>
                <Label htmlFor="model">LLM Provider</Label>
                <Select
                  value={formData.model}
                  onValueChange={(value) => setFormData({ ...formData, model: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="perplexity">Perplexity</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="modelId">Model</Label>
                <Select
                  value={(formData as any).modelId || ""}
                  onValueChange={(value) => setFormData({ ...formData, modelId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {getModelsForProvider(formData.model).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="promptText">Task Instructions</Label>
                <Textarea
                  id="promptText"
                  value={formData.promptText}
                  onChange={(e) => setFormData({ ...formData, promptText: e.target.value })}
                  placeholder="Enter your prompt using {{column_name}} for dynamic values..."
                  className="min-h-32"
                />
              </div>
              <div>
                <Label htmlFor="outputColumnName">Output Column Name</Label>
                <Input
                  id="outputColumnName"
                  value={formData.outputColumnName}
                  onChange={(e) => setFormData({ ...formData, outputColumnName: e.target.value })}
                  placeholder="e.g., lead_score"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-oracle-accent hover:bg-oracle-accent/90 text-white"
                >
                  <Save size={16} className="mr-2" />
                  {editingTemplate ? "Update" : "Save"} Template
                </Button>
              </div>
            </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isSysDialogOpen} onOpenChange={setSysDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => { setEditingSystem(null); setSysForm({ userId: "", name: "", systemText: "" }); setSysDialogOpen(true); }}
                variant="outline"
                className="hover:bg-oracle-accent hover:text-white hover:border-oracle-accent"
              >
                <Plus size={16} className="mr-2" />
                {MC.templatesPage.buttons.newRole.label}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingSystem ? "Edit expert role" : "Create New Expert Role"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sys_name">Name</Label>
                <Input id="sys_name" value={sysForm.name} onChange={(e) => setSysForm({ ...sysForm, name: e.target.value })} placeholder="e.g., Strict JSON output" />
              </div>
              <div>
                <Label htmlFor="systemText">System Message</Label>
                <Textarea id="systemText" value={sysForm.systemText} onChange={(e) => setSysForm({ ...sysForm, systemText: e.target.value })} placeholder="Enter system instructions; supports {{variables}}" className="min-h-32" />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setSysDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!sysForm.name || !sysForm.systemText) { toast({ title: "Validation Error", description: "Please fill in name and system message.", variant: "destructive" }); return; }
                  if (editingSystem) sysUpdate.mutate({ systemTemplateId: editingSystem.systemTemplateId, data: sysForm }); else sysCreate.mutate(sysForm);
                }} className="bg-oracle-accent hover:bg-oracle-accent/90 text-white">
                  <Save size={16} className="mr-2" />
                  {editingSystem ? "Update" : "Save"} Expert Role
                </Button>
              </div>
            </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {activeTab === "Tasks" ? (
        !templates || (Array.isArray(templates) && templates.length === 0) ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="text-center py-8 oracle-muted">
            No templates found. Create your first template to get started.
          </div>
        </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(templates as PromptTemplate[]).map((template: PromptTemplate) => (
            <div
              key={template.promptId}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold oracle-heading">{template.name}</h3>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(template)}
                    className="text-gray-500 hover:text-oracle-accent"
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template.promptId)}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-xs oracle-muted uppercase font-medium mb-1">Model</div>
                <div className="text-sm capitalize">{template.model}</div>
              </div>

              <div className="mb-3">
                <div className="text-xs oracle-muted uppercase font-medium mb-1">Output Column</div>
                <div className="text-sm">{template.outputColumnName}</div>
              </div>

              <div>
                <div className="text-xs oracle-muted uppercase font-medium mb-1">Prompt</div>
                <div className="text-sm oracle-muted line-clamp-3">{template.promptText}</div>
              </div>

              <div className="text-xs oracle-muted mt-3">
                Created {new Date(template.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
        )
      ) : (
        !systemTemplates || (Array.isArray(systemTemplates) && systemTemplates.length === 0) ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="text-center py-8 oracle-muted">No expert roles found. Create one to get started.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(systemTemplates as SystemTemplate[]).map((tpl) => (
              <div key={tpl.systemTemplateId} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold oracle-heading">{tpl.name}</h3>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingSystem(tpl); setSysForm({ userId: tpl.userId, name: tpl.name, systemText: (tpl as any).systemText }); setSysDialogOpen(true); }} className="text-gray-500 hover:text-oracle-accent"><Edit size={16} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => sysDelete.mutate(tpl.systemTemplateId)} className="text-gray-500 hover:text-red-500"><Trash2 size={16} /></Button>
                  </div>
                </div>
                <div className="text-xs oracle-muted uppercase font-medium mb-1">System Message</div>
                <div className="text-sm oracle-muted line-clamp-3">{(tpl as any).systemText}</div>
                <div className="text-xs oracle-muted mt-3">Created {new Date(tpl.createdAt as any).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
