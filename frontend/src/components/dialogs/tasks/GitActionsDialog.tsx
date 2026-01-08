import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { ExternalLink, GitPullRequest } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Merge, TaskWithAttemptStatus, Workspace } from "shared/types";
import GitOperations from "@/components/tasks/Toolbar/GitOperations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import { ExecutionProcessesProvider } from "@/contexts/ExecutionProcessesContext";
import {
  GitOperationsProvider,
  useGitOperationsError,
} from "@/contexts/GitOperationsContext";
import { useAttemptExecution, useBranchStatus } from "@/hooks";
import { useAttemptRepo } from "@/hooks/useAttemptRepo";
import { useTaskAttempt } from "@/hooks/useTaskAttempt";
import { defineModal } from "@/lib/modals";

export interface GitActionsDialogProps {
  attemptId: string;
  task?: TaskWithAttemptStatus;
}

interface GitActionsDialogContentProps {
  attempt: Workspace;
  task: TaskWithAttemptStatus;
}

function GitActionsDialogContent({
  attempt,
  task,
}: GitActionsDialogContentProps) {
  const { t } = useTranslation("tasks");
  const { data: branchStatus } = useBranchStatus(attempt.id);
  const { isAttemptRunning } = useAttemptExecution(attempt.id);
  const { error: gitError } = useGitOperationsError();
  const { repos, selectedRepoId } = useAttemptRepo(attempt.id);

  const getSelectedRepoStatus = () => {
    const repoId = selectedRepoId ?? repos[0]?.id;
    return branchStatus?.find((r) => r.repo_id === repoId);
  };

  const mergedPR = getSelectedRepoStatus()?.merges?.find(
    (m: Merge) => m.type === "pr" && m.pr_info?.status === "merged"
  );

  return (
    <div className="space-y-4">
      {mergedPR && mergedPR.type === "pr" && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span>
            {t("git.actions.prMerged", {
              number: mergedPR.pr_info.number || "",
            })}
          </span>
          {mergedPR.pr_info.url && (
            <a
              className="inline-flex items-center gap-1 text-primary hover:underline"
              href={mergedPR.pr_info.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <GitPullRequest className="h-3.5 w-3.5" />
              {t("git.pr.number", {
                number: Number(mergedPR.pr_info.number),
              })}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
      {gitError && (
        <div className="rounded border border-destructive p-3 text-destructive text-sm">
          {gitError}
        </div>
      )}
      <GitOperations
        branchStatus={branchStatus ?? null}
        isAttemptRunning={isAttemptRunning}
        layout="vertical"
        selectedAttempt={attempt}
        selectedBranch={getSelectedRepoStatus()?.target_branch_name ?? null}
        task={task}
      />
    </div>
  );
}

const GitActionsDialogImpl = NiceModal.create<GitActionsDialogProps>(
  ({ attemptId, task }) => {
    const modal = useModal();
    const { t } = useTranslation("tasks");

    const { data: attempt } = useTaskAttempt(attemptId);

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        modal.hide();
      }
    };

    const isLoading = !(attempt && task);

    return (
      <Dialog onOpenChange={handleOpenChange} open={modal.visible}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("git.actions.title")}</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="py-8">
              <Loader size={24} />
            </div>
          ) : (
            <GitOperationsProvider attemptId={attempt.id}>
              <ExecutionProcessesProvider
                attemptId={attempt.id}
                key={attempt.id}
              >
                <GitActionsDialogContent attempt={attempt} task={task} />
              </ExecutionProcessesProvider>
            </GitOperationsProvider>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

export const GitActionsDialog = defineModal<GitActionsDialogProps, void>(
  GitActionsDialogImpl
);
