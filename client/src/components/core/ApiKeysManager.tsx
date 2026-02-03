import { useEffect, useState } from "react";
import { Check, AlertTriangle, Edit, Trash2 } from "lucide-react";
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
import { useAuthContext } from "@/context/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import type { ApiKeysRequest } from "@shared/schema";

interface ApiKeysManagerProps {
  headerless?: boolean;
  containerless?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ApiKeysManager({ headerless = false, containerless = false, open, onOpenChange }: ApiKeysManagerProps) {
  const { user, saveApiKeys, isSavingKeys } = useAuthContext();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = typeof open === "boolean" ? open : internalOpen;
  const setIsOpen = (v: boolean) => {
    console.log("ApiKeysManager.setIsOpen", { next: v, controlled: typeof open === "boolean" });
    if (onOpenChange) onOpenChange(v);
    if (typeof open !== "boolean") setInternalOpen(v);
  };

  useEffect(() => {
    console.log("ApiKeysManager.mounted", { headerless, containerless });
  }, [headerless, containerless]);
  const [keys, setKeys] = useState<ApiKeysRequest>({
    openai: "",
    gemini: "",
    perplexity: "",
    deepseek: "",
    anthropic: "",
  });

  const savedKeys = (user?.llmApiKeys as Record<string, string>) || {};

  const providers = [
    { key: "openai" as const, name: "OpenAI", configured: !!savedKeys.openai },
    { key: "gemini" as const, name: "Google Gemini", configured: !!savedKeys.gemini },
    { key: "perplexity" as const, name: "Perplexity", configured: !!savedKeys.perplexity },
    { key: "deepseek" as const, name: "DeepSeek", configured: !!savedKeys.deepseek },
    { key: "anthropic" as const, name: "Anthropic", configured: !!savedKeys.anthropic },
  ];

  const handleDelete = (provider: (typeof providers)[number]["key"]) => {
    // Server-side merge supports null to delete; leave others untouched
    console.log("ApiKeysManager.handleDelete", { provider });
    const payload = { [provider]: null } as unknown as ApiKeysRequest;
    saveApiKeys(payload);
    toast({
      title: `${providers.find((p) => p.key === provider)?.name} key deleted`,
      description: "The key was removed. You can re-add it anytime.",
    });
  };

  const handleSave = () => {
    const filteredKeys = Object.fromEntries(
      Object.entries(keys).filter((entry) => entry[1].trim() !== ""),
    ) as ApiKeysRequest;

    saveApiKeys(filteredKeys);
    toast({
      title: "API Keys Saved",
      description: "Your API keys have been securely stored.",
    });
    setIsOpen(false);
    setKeys({ openai: "", gemini: "", perplexity: "", deepseek: "", anthropic: "" });
  };

  // Centralized dialog body to avoid duplication and ensure parity across all render paths
  const DialogBody = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="openai">OpenAI API Key</Label>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs px-2 py-0.5 rounded ${savedKeys.openai ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
              data-testid="status-openai"
            >
              {savedKeys.openai ? "Configured" : "Not configured"}
            </span>
            {savedKeys.openai && (
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleDelete("openai")}
                disabled={isSavingKeys}
                data-testid="button-delete-openai-key"
                aria-label="Delete OpenAI key"
                title="Delete OpenAI key"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
        <Input
          id="openai"
          type="password"
          placeholder="sk-..."
          value={keys.openai}
          onChange={(e) => setKeys({ ...keys, openai: e.target.value })}
          data-testid="input-openai-key"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="gemini">Google Gemini API Key</Label>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs px-2 py-0.5 rounded ${savedKeys.gemini ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
              data-testid="status-gemini"
            >
              {savedKeys.gemini ? "Configured" : "Not configured"}
            </span>
            {savedKeys.gemini && (
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleDelete("gemini")}
                disabled={isSavingKeys}
                data-testid="button-delete-gemini-key"
                aria-label="Delete Gemini key"
                title="Delete Gemini key"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
        <Input
          id="gemini"
          type="password"
          placeholder="AI..."
          value={keys.gemini}
          onChange={(e) => setKeys({ ...keys, gemini: e.target.value })}
          data-testid="input-gemini-key"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="perplexity">Perplexity API Key</Label>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs px-2 py-0.5 rounded ${savedKeys.perplexity ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
              data-testid="status-perplexity"
            >
              {savedKeys.perplexity ? "Configured" : "Not configured"}
            </span>
            {savedKeys.perplexity && (
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleDelete("perplexity")}
                disabled={isSavingKeys}
                data-testid="button-delete-perplexity-key"
                aria-label="Delete Perplexity key"
                title="Delete Perplexity key"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
        <Input
          id="perplexity"
          type="password"
          placeholder="pplx-..."
          value={keys.perplexity}
          onChange={(e) => setKeys({ ...keys, perplexity: e.target.value })}
          data-testid="input-perplexity-key"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="deepseek">DeepSeek API Key</Label>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs px-2 py-0.5 rounded ${savedKeys.deepseek ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
              data-testid="status-deepseek"
            >
              {savedKeys.deepseek ? "Configured" : "Not configured"}
            </span>
            {savedKeys.deepseek && (
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleDelete("deepseek")}
                disabled={isSavingKeys}
                data-testid="button-delete-deepseek-key"
                aria-label="Delete DeepSeek key"
                title="Delete DeepSeek key"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
        <Input
          id="deepseek"
          type="password"
          placeholder="sk-..."
          value={keys.deepseek}
          onChange={(e) => setKeys({ ...keys, deepseek: e.target.value })}
          data-testid="input-deepseek-key"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="anthropic">Anthropic API Key</Label>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs px-2 py-0.5 rounded ${savedKeys.anthropic ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
              data-testid="status-anthropic"
            >
              {savedKeys.anthropic ? "Configured" : "Not configured"}
            </span>
            {savedKeys.anthropic && (
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleDelete("anthropic")}
                disabled={isSavingKeys}
                data-testid="button-delete-anthropic-key"
                aria-label="Delete Anthropic key"
                title="Delete Anthropic key"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
        <Input
          id="anthropic"
          type="password"
          placeholder="sk-ant-..."
          value={keys.anthropic}
          onChange={(e) => setKeys({ ...keys, anthropic: e.target.value })}
          data-testid="input-anthropic-key"
        />
      </div>
      <Button stackOnNarrow size="compact"
        onClick={handleSave}
        disabled={isSavingKeys}
        data-testid="button-save-keys"
        className="w-full bg-oracle-accent hover:bg-oracle-accent/90"
      >
        {isSavingKeys ? "Saving..." : "Save Keys"}
      </Button>
    </div>
  );

  const header = (
    <div className="p-4 lg:p-6 border-b border-oracle-border">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-semibold oracle-heading">API KEYS</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          {!headerless ? (
            <DialogTrigger asChild>
              <Button stackOnNarrow size="compact"
                variant="outline"
                data-testid="button-manage-keys"
                className="border-oracle-accent text-oracle-accent hover:bg-oracle-accent hover:text-white"
              >
                <Edit size={16} className="mr-1" />
                Manage Keys
              </Button>
            </DialogTrigger>
          ) : null}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage API Keys</DialogTitle>
            </DialogHeader>
            <DialogBody />
          </DialogContent>
        </Dialog>
      </div>
      {!headerless ? (
        <>
          <p className="text-sm oracle-muted mt-2">
            Click on Manage Keys to configure all the API keys for the models that you want to use for sending your queries.
          </p>
          <p className="text-xs oracle-muted mt-2" data-testid="help-api-key-docs">
            Need help finding your API keys? Visit:
            {" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-oracle-accent"
            >
              OpenAI
            </a>
            {", "}
            <a
              href="https://www.perplexity.ai/help-center/en/articles/10352995-api-settings"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-oracle-accent"
            >
              Perplexity
            </a>
            {", "}
            <a
              href="https://ai.google.dev/gemini-api/docs/api-key"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-oracle-accent"
            >
              Google Gemini
            </a>
            {", "}
            <a
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-oracle-accent"
            >
              DeepSeek
            </a>
            .
          </p>
        </>
      ) : null}
    </div>
  );

  const providersGrid = (
    <div className="p-4 lg:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {providers.map(({ key, name, configured }) => (
          <div 
            key={key} 
            className="bg-gray-50 border border-gray-200 rounded-lg p-3 lg:p-4 flex flex-col items-center justify-center text-center min-h-[80px] lg:min-h-[100px]"
            data-testid={`provider-card-${key}`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                configured ? "bg-green-100" : "bg-yellow-100"
              }`}
            >
              {configured ? (
                <Check className="text-green-600" size={20} />
              ) : (
                <AlertTriangle className="text-yellow-600" size={20} />
              )}
            </div>
            <div className="font-medium text-sm oracle-heading mb-1">{name}</div>
            <div className="text-xs oracle-muted">
              {configured ? "Configured" : "Not configured"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (containerless) {
    return (
      <>
        {/* Dialog and optional header content */}
        {!headerless ? header : (
          // When headerless, still render Dialog mounted for external action control with full content
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage API Keys</DialogTitle>
              </DialogHeader>
              <DialogBody />
            </DialogContent>
          </Dialog>
        )}
        {providersGrid}
      </>
    );
  }

  return (
    <div className="bg-white border border-oracle-border rounded-lg shadow-sm">
      {headerless ? (
        // Render only the Dialog (controlled) without visible header section
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          {/* No trigger inside when headerless; open controlled by parent */}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage API Keys</DialogTitle>
            </DialogHeader>
            <DialogBody />
          </DialogContent>
        </Dialog>
      ) : (
        header
      )}
      {providersGrid}
    </div>
  );
}
