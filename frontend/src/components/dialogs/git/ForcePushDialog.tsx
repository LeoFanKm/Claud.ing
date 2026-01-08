import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForcePush } from "@/hooks/useForcePush";
import { defineModal } from "@/lib/modals";

export interface ForcePushDialogProps {
  attemptId: string;
  repoId: string;
  branchName?: string;
}

const ForcePushDialogImpl = NiceModal.create<ForcePushDialogProps>((props) => {
  const modal = useModal();
  const { attemptId, repoId, branchName } = props;
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(["tasks", "common"]);
  const branchLabel = branchName ? ` "${branchName}"` : "";

  const forcePush = useForcePush(
    attemptId,
    () => {
      // Success - close dialog
      modal.resolve("success");
      modal.hide();
    },
    (err: unknown) => {
      // Error - show in dialog and keep open
      const message =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : t("tasks:git.forcePushDialog.error");
      setError(message);
    }
  );

  const handleConfirm = async () => {
    setError(null);
    try {
      await forcePush.mutateAsync({ repo_id: repoId });
    } catch {
      // Error already handled by onError callback
    }
  };

  const handleCancel = () => {
    modal.resolve("canceled");
    modal.hide();
  };

  const isProcessing = forcePush.isPending;

  return (
    <Dialog onOpenChange={handleCancel} open={modal.visible}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <DialogTitle>{t("tasks:git.forcePushDialog.title")}</DialogTitle>
          </div>
          <DialogDescription className="space-y-2 pt-2 text-left">
            <p>{t("tasks:git.forcePushDialog.description", { branchLabel })}</p>
            <p className="font-medium">
              {t("tasks:git.forcePushDialog.warning")}
            </p>
            <p className="text-muted-foreground text-sm">
              {t("tasks:git.forcePushDialog.note")}
            </p>
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-2">
          <Button
            disabled={isProcessing}
            onClick={handleCancel}
            variant="outline"
          >
            {t("common:buttons.cancel")}
          </Button>
          <Button
            disabled={isProcessing}
            onClick={handleConfirm}
            variant="destructive"
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessing
              ? t("tasks:git.states.forcePushing")
              : t("tasks:git.states.forcePush")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export const ForcePushDialog = defineModal<ForcePushDialogProps, string>(
  ForcePushDialogImpl
);
