import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProject } from "@/contexts/ProjectContext";
import type { SharedTaskRecord } from "@/hooks/useProjectTasks";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { defineModal } from "@/lib/modals";

export interface StopShareTaskDialogProps {
  sharedTask: SharedTaskRecord;
}

const StopShareTaskDialogImpl = NiceModal.create<StopShareTaskDialogProps>(
  ({ sharedTask }) => {
    const modal = useModal();
    const { t } = useTranslation("tasks");
    const { projectId } = useProject();
    const { stopShareTask } = useTaskMutations(projectId ?? undefined);
    const [error, setError] = useState<string | null>(null);
    const isProgrammaticCloseRef = useRef(false);
    const didConfirmRef = useRef(false);

    const getReadableError = (err: unknown) =>
      err instanceof Error && err.message
        ? err.message
        : t("stopShareDialog.genericError");

    const requestClose = (didConfirm: boolean) => {
      if (stopShareTask.isPending) {
        return;
      }
      isProgrammaticCloseRef.current = true;
      didConfirmRef.current = didConfirm;
      modal.hide();
    };

    const handleCancel = () => {
      requestClose(false);
    };

    const handleConfirm = async () => {
      setError(null);
      try {
        await stopShareTask.mutateAsync(sharedTask.id);
        requestClose(true);
      } catch (err: unknown) {
        setError(getReadableError(err));
      }
    };

    return (
      <Dialog
        onOpenChange={(open) => {
          if (open) {
            stopShareTask.reset();
            setError(null);
            isProgrammaticCloseRef.current = false;
            didConfirmRef.current = false;
            return;
          }

          if (stopShareTask.isPending) {
            return;
          }

          const shouldResolve =
            isProgrammaticCloseRef.current && didConfirmRef.current;

          isProgrammaticCloseRef.current = false;
          didConfirmRef.current = false;
          stopShareTask.reset();

          if (shouldResolve) {
            modal.resolve();
          } else {
            modal.reject();
          }
        }}
        open={modal.visible}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("stopShareDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("stopShareDialog.description", { title: sharedTask.title })}
            </DialogDescription>
          </DialogHeader>

          <Alert className="mb-4" variant="destructive">
            {t("stopShareDialog.warning")}
          </Alert>

          {error && (
            <Alert className="mb-4" variant="destructive">
              {error}
            </Alert>
          )}

          <DialogFooter>
            <Button
              autoFocus
              disabled={stopShareTask.isPending}
              onClick={handleCancel}
              variant="outline"
            >
              {t("common:buttons.cancel")}
            </Button>
            <Button
              disabled={stopShareTask.isPending}
              onClick={handleConfirm}
              variant="destructive"
            >
              {stopShareTask.isPending
                ? t("stopShareDialog.inProgress")
                : t("stopShareDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

export const StopShareTaskDialog = defineModal<StopShareTaskDialogProps, void>(
  StopShareTaskDialogImpl
);
