import { MainLayout } from "@/components/layout/MainLayout";
import { ApiKeysManager } from "@/components/core/ApiKeysManager";
import { Button } from "@/components/ui/button";
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
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuthContext } from "@/context/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionCard } from "@/components/ui/SectionCard";

export default function Settings() {
  const { logout } = useAuthContext();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      console.log("Delete Account initiated");
      const res = await api.account.delete();
      console.log("Delete Account response status", res.status);
      toast({ title: "Account deleted", description: "Your account and data have been permanently removed." });
      await logout();
      window.location.href = "/";
    } catch (error: any) {
      console.error("Delete Account failed", { message: error?.message, code: error?.code, requestId: error?.requestId });
      toast({ title: "Failed to delete account", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-4xl font-bold oracle-heading mb-2">Settings</h1>
        <p className="text-lg oracle-muted">Manage your account settings and API configurations</p>
      </div>

      <div className="space-y-8">
        <SectionCard
          id="api-keys"
          title="API Keys"
          subheader={
            <>
              Configure API keys for your preferred LLM providers.{" "}
              <a
                href="/how-it-works#api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-oracle-accent underline"
              >
                Learn about API keys
              </a>
              .
            </>
          }
          headerDivider={false}
          actions={
            <Button
              stackOnNarrow
              size="compact"
              variant="outline"
              data-testid="button-manage-keys"
              className="border-oracle-accent text-oracle-accent hover:bg-oracle-accent hover:text-white"
              onClick={() => {
                console.log("[Settings] Manage Keys clicked -> opening ApiKeysManager dialog");
                setApiKeysOpen(true);
              }}
            >
              Manage Keys
            </Button>
          }
        >
          <ApiKeysManager headerless containerless open={apiKeysOpen} onOpenChange={setApiKeysOpen} />
        </SectionCard>

        <SectionCard
          id="account"
          title="Account"
          subheader="Delete your account and all associated data. This action is permanent."
        >
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete account"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account, files, jobs, templates, storage artifacts, and your login. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting}>
                  {isDeleting ? "Deleting..." : "Confirm delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SectionCard>
      </div>
    </MainLayout>
  );
}
