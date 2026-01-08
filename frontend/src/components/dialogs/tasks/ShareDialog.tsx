import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { Link as LinkIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TaskWithAttemptStatus } from "shared/types";
import { useUserSystem } from "@/components/ConfigProvider";
import { OAuthDialog } from "@/components/dialogs/global/OAuthDialog";
import { LinkProjectDialog } from "@/components/dialogs/projects/LinkProjectDialog";
import { LoginRequiredPrompt } from "@/components/dialogs/shared/LoginRequiredPrompt";
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
import { useClerkEnabled } from "@/contexts/ClerkContext";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/hooks";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { defineModal } from "@/lib/modals";

export interface ShareDialogProps {
  task: TaskWithAttemptStatus;
}

const ShareDialogImpl = NiceModal.create<ShareDialogProps>(({ task }) => {
  const modal = useModal();
  const { t } = useTranslation("tasks");
  const { loading: systemLoading } = useUserSystem();
  const { isSignedIn } = useAuth();
  const { project } = useProject();
  const { shareTask } = useTaskMutations(task.project_id);
  const { reset: resetShareTask } = shareTask;
  const isClerkEnabled = useClerkEnabled();

  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    resetShareTask();
    setShareError(null);
  }, [task.id, resetShareTask]);

  const handleClose = () => {
    modal.resolve(shareTask.isSuccess);
    modal.hide();
  };

  const getStatus = (err: unknown) =>
    err && typeof err === "object" && "status" in err
      ? (err as { status?: number }).status
      : undefined;

  const getReadableError = (err: unknown) => {
    const status = getStatus(err);
    if (status === 401) {
      return err instanceof Error && err.message
        ? err.message
        : t("shareDialog.loginRequired.description");
    }
    return err instanceof Error ? err.message : t("shareDialog.genericError");
  };

  const handleShare = async () => {
    setShareError(null);
    try {
      await shareTask.mutateAsync(task.id);
      modal.hide();
    } catch (err) {
      if (getStatus(err) === 401) {
        if (isClerkEnabled) {
          // With Clerk, 401 means session expired - show error and let user re-login via navbar
          setShareError(
            t(
              "shareDialog.sessionExpired",
              "Session expired. Please sign in again."
            )
          );
          return;
        }
        // Legacy OAuth flow
        modal.hide();
        const result = await OAuthDialog.show();
        if (result) {
          void ShareDialog.show({ task });
        }
        return;
      }
      setShareError(getReadableError(err));
    }
  };

  const handleLinkProject = () => {
    if (!project) return;

    void LinkProjectDialog.show({
      projectId: project.id,
      projectName: project.name,
    });
  };

  const isShareDisabled = systemLoading || shareTask.isPending;
  const isProjectLinked = project?.remote_project_id != null;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          shareTask.reset();
          setShareError(null);
        } else {
          handleClose();
        }
      }}
      open={modal.visible}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("shareDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("shareDialog.description", { title: task.title })}
          </DialogDescription>
        </DialogHeader>

        {isSignedIn ? (
          isProjectLinked ? (
            <>
              {shareTask.isSuccess ? (
                <Alert variant="success">{t("shareDialog.success")}</Alert>
              ) : (
                <>
                  {shareError && (
                    <Alert variant="destructive">{shareError}</Alert>
                  )}
                </>
              )}
            </>
          ) : (
            <Alert className="mt-1">
              <LinkIcon className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{t("shareDialog.linkProjectRequired.description")}</span>
                <Button
                  className="ml-2"
                  onClick={handleLinkProject}
                  size="sm"
                  variant="outline"
                >
                  {t("shareDialog.linkProjectRequired.action")}
                </Button>
              </AlertDescription>
            </Alert>
          )
        ) : (
          <LoginRequiredPrompt
            buttonClassName="mt-1"
            buttonSize="sm"
            buttonVariant="outline"
          />
        )}

        <DialogFooter className="flex gap-2 sm:flex-row sm:justify-end">
          <Button onClick={handleClose} variant="outline">
            {shareTask.isSuccess
              ? t("shareDialog.closeButton")
              : t("shareDialog.cancel")}
          </Button>
          {isSignedIn && isProjectLinked && !shareTask.isSuccess && (
            <Button
              className="gap-2"
              disabled={isShareDisabled}
              onClick={handleShare}
            >
              {shareTask.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("shareDialog.inProgress")}
                </>
              ) : (
                t("shareDialog.confirm")
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export const ShareDialog = defineModal<ShareDialogProps, boolean>(
  ShareDialogImpl
);
