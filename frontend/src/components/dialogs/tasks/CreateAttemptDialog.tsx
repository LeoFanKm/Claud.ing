import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BaseCodingAgent, ExecutorProfileId } from "shared/types";
import { useUserSystem } from "@/components/ConfigProvider";
import { ExecutorProfileSelector } from "@/components/settings";
import RepoBranchSelector from "@/components/tasks/RepoBranchSelector";
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
import {
  useAttempt,
  useNavigateWithSearch,
  useProjectRepos,
  useRepoBranchSelection,
  useTask,
} from "@/hooks";
import { useAttemptCreation } from "@/hooks/useAttemptCreation";
import { useTaskAttemptsWithSessions } from "@/hooks/useTaskAttempts";
import { Scope, useKeySubmitTask } from "@/keyboard";
import { defineModal } from "@/lib/modals";
import { paths } from "@/lib/paths";

export interface CreateAttemptDialogProps {
  taskId: string;
}

const CreateAttemptDialogImpl = NiceModal.create<CreateAttemptDialogProps>(
  ({ taskId }) => {
    const modal = useModal();
    const navigate = useNavigateWithSearch();
    const { projectId } = useProject();
    const { t } = useTranslation("tasks");
    const { profiles, config } = useUserSystem();
    const { createAttempt, isCreating, error } = useAttemptCreation({
      taskId,
      onSuccess: (attempt) => {
        if (projectId) {
          navigate(paths.attempt(projectId, taskId, attempt.id));
        }
      },
    });

    const [userSelectedProfile, setUserSelectedProfile] =
      useState<ExecutorProfileId | null>(null);

    const { data: attempts = [], isLoading: isLoadingAttempts } =
      useTaskAttemptsWithSessions(taskId, {
        enabled: modal.visible,
        refetchInterval: 5000,
      });

    const { data: task, isLoading: isLoadingTask } = useTask(taskId, {
      enabled: modal.visible,
    });

    const parentAttemptId = task?.parent_workspace_id ?? undefined;
    const { data: parentAttempt, isLoading: isLoadingParent } = useAttempt(
      parentAttemptId,
      { enabled: modal.visible && !!parentAttemptId }
    );

    const { data: projectRepos = [], isLoading: isLoadingRepos } =
      useProjectRepos(projectId, { enabled: modal.visible });

    const {
      configs: repoBranchConfigs,
      isLoading: isLoadingBranches,
      setRepoBranch,
      getWorkspaceRepoInputs,
      reset: resetBranchSelection,
    } = useRepoBranchSelection({
      repos: projectRepos,
      initialBranch: parentAttempt?.branch,
      enabled: modal.visible && projectRepos.length > 0,
    });

    const latestAttempt = useMemo(() => {
      if (attempts.length === 0) return null;
      return attempts.reduce((latest, attempt) =>
        new Date(attempt.created_at) > new Date(latest.created_at)
          ? attempt
          : latest
      );
    }, [attempts]);

    useEffect(() => {
      if (!modal.visible) {
        setUserSelectedProfile(null);
        resetBranchSelection();
      }
    }, [modal.visible, resetBranchSelection]);

    const defaultProfile: ExecutorProfileId | null = useMemo(() => {
      if (latestAttempt?.session?.executor) {
        const lastExec = latestAttempt.session.executor as BaseCodingAgent;
        // If the last attempt used the same executor as the user's current preference,
        // we assume they want to use their preferred variant as well.
        // Otherwise, we default to the "default" variant (null) since we don't know
        // what variant they used last time (TaskAttempt doesn't store it).
        const variant =
          config?.executor_profile?.executor === lastExec
            ? config.executor_profile.variant
            : null;

        return {
          executor: lastExec,
          variant,
        };
      }
      return config?.executor_profile ?? null;
    }, [latestAttempt?.session?.executor, config?.executor_profile]);

    const effectiveProfile = userSelectedProfile ?? defaultProfile;

    const isLoadingInitial =
      isLoadingRepos ||
      isLoadingBranches ||
      isLoadingAttempts ||
      isLoadingTask ||
      isLoadingParent;

    const allBranchesSelected = repoBranchConfigs.every(
      (c) => c.targetBranch !== null
    );

    const canCreate = Boolean(
      effectiveProfile &&
        allBranchesSelected &&
        projectRepos.length > 0 &&
        !isCreating &&
        !isLoadingInitial
    );

    const handleCreate = async () => {
      if (
        !(effectiveProfile && allBranchesSelected) ||
        projectRepos.length === 0
      )
        return;
      try {
        const repos = getWorkspaceRepoInputs();

        await createAttempt({
          profile: effectiveProfile,
          repos,
        });

        modal.hide();
      } catch (err) {
        console.error("Failed to create attempt:", err);
      }
    };

    const handleOpenChange = (open: boolean) => {
      if (!open) modal.hide();
    };

    useKeySubmitTask(handleCreate, {
      enabled: modal.visible && canCreate,
      scope: Scope.DIALOG,
      preventDefault: true,
    });

    return (
      <Dialog onOpenChange={handleOpenChange} open={modal.visible}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("createAttemptDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("createAttemptDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {profiles && (
              <div className="space-y-2">
                <ExecutorProfileSelector
                  onProfileSelect={setUserSelectedProfile}
                  profiles={profiles}
                  selectedProfile={effectiveProfile}
                  showLabel={true}
                />
              </div>
            )}

            <RepoBranchSelector
              className="space-y-2"
              configs={repoBranchConfigs}
              isLoading={isLoadingBranches}
              onBranchChange={setRepoBranch}
            />

            {error && (
              <div className="text-destructive text-sm">
                {t("createAttemptDialog.error")}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={isCreating}
              onClick={() => modal.hide()}
              variant="outline"
            >
              {t("common:buttons.cancel")}
            </Button>
            <Button disabled={!canCreate} onClick={handleCreate}>
              {isCreating
                ? t("createAttemptDialog.creating")
                : t("createAttemptDialog.start")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

export const CreateAttemptDialog = defineModal<CreateAttemptDialogProps, void>(
  CreateAttemptDialogImpl
);
