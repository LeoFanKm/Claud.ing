import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  GitBranch as GitBranchIcon,
  GitPullRequest,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Merge,
  RepoBranchStatus,
  TaskWithAttemptStatus,
  Workspace,
} from "shared/types";
import { ChangeTargetBranchDialog } from "@/components/dialogs/tasks/ChangeTargetBranchDialog";
import { CreatePRDialog } from "@/components/dialogs/tasks/CreatePRDialog";
import { RebaseDialog } from "@/components/dialogs/tasks/RebaseDialog";
import RepoSelector from "@/components/tasks/RepoSelector";
import { Button } from "@/components/ui/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { useRepoBranches } from "@/hooks";
import { useAttemptRepo } from "@/hooks/useAttemptRepo";
import { useGitOperations } from "@/hooks/useGitOperations";

interface GitOperationsProps {
  selectedAttempt: Workspace;
  task: TaskWithAttemptStatus;
  branchStatus: RepoBranchStatus[] | null;
  isAttemptRunning: boolean;
  selectedBranch: string | null;
  layout?: "horizontal" | "vertical";
}

export type GitOperationsInputs = Omit<GitOperationsProps, "selectedAttempt">;

function GitOperations({
  selectedAttempt,
  task,
  branchStatus,
  isAttemptRunning,
  selectedBranch,
  layout = "horizontal",
}: GitOperationsProps) {
  const { t } = useTranslation("tasks");

  const { repos, selectedRepoId, setSelectedRepoId } = useAttemptRepo(
    selectedAttempt.id
  );
  const git = useGitOperations(selectedAttempt.id, selectedRepoId ?? undefined);
  const { data: branches = [] } = useRepoBranches(selectedRepoId);
  const isChangingTargetBranch = git.states.changeTargetBranchPending;

  // Local state for git operations
  const [merging, setMerging] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [rebasing, setRebasing] = useState(false);
  const [mergeSuccess, setMergeSuccess] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);

  // Target branch change handlers
  const handleChangeTargetBranchClick = async (newBranch: string) => {
    const repoId = getSelectedRepoId();
    if (!repoId) return;
    await git.actions.changeTargetBranch({
      newTargetBranch: newBranch,
      repoId,
    });
  };

  const handleChangeTargetBranchDialogOpen = async () => {
    try {
      const result = await ChangeTargetBranchDialog.show({
        branches,
        isChangingTargetBranch,
      });

      if (result.action === "confirmed" && result.branchName) {
        await handleChangeTargetBranchClick(result.branchName);
      }
    } catch (error) {
      // User cancelled - do nothing
    }
  };

  const getSelectedRepoId = useCallback(() => {
    return selectedRepoId ?? repos[0]?.id;
  }, [selectedRepoId, repos]);

  const getSelectedRepoStatus = useCallback(() => {
    const repoId = getSelectedRepoId();
    return branchStatus?.find((r) => r.repo_id === repoId);
  }, [branchStatus, getSelectedRepoId]);

  // Memoize the selected repo status for use in button disabled states
  const selectedRepoStatus = useMemo(
    () => getSelectedRepoStatus(),
    [getSelectedRepoStatus]
  );

  const hasConflictsCalculated =
    (selectedRepoStatus?.conflicted_files?.length ?? 0) > 0;

  // Memoize merge status information to avoid repeated calculations
  const mergeInfo = useMemo(() => {
    const selectedRepoStatus = getSelectedRepoStatus();
    if (!selectedRepoStatus?.merges)
      return {
        hasOpenPR: false,
        openPR: null,
        hasMergedPR: false,
        mergedPR: null,
        hasMerged: false,
        latestMerge: null,
      };

    const openPR = selectedRepoStatus.merges.find(
      (m: Merge) => m.type === "pr" && m.pr_info.status === "open"
    );

    const mergedPR = selectedRepoStatus.merges.find(
      (m: Merge) => m.type === "pr" && m.pr_info.status === "merged"
    );

    const merges = selectedRepoStatus.merges.filter(
      (m: Merge) =>
        m.type === "direct" ||
        (m.type === "pr" && m.pr_info.status === "merged")
    );

    return {
      hasOpenPR: !!openPR,
      openPR,
      hasMergedPR: !!mergedPR,
      mergedPR,
      hasMerged: merges.length > 0,
      latestMerge: selectedRepoStatus.merges[0] || null, // Most recent merge
    };
  }, [getSelectedRepoStatus]);

  const mergeButtonLabel = useMemo(() => {
    if (mergeSuccess) return t("git.states.merged");
    if (merging) return t("git.states.merging");
    return t("git.states.merge");
  }, [mergeSuccess, merging, t]);

  const rebaseButtonLabel = useMemo(() => {
    if (rebasing) return t("git.states.rebasing");
    return t("git.states.rebase");
  }, [rebasing, t]);

  const prButtonLabel = useMemo(() => {
    if (mergeInfo.hasOpenPR) {
      return pushSuccess
        ? t("git.states.pushed")
        : pushing
          ? t("git.states.pushing")
          : t("git.states.push");
    }
    return t("git.states.createPr");
  }, [mergeInfo.hasOpenPR, pushSuccess, pushing, t]);

  const handleMergeClick = async () => {
    // Directly perform merge without checking branch status
    await performMerge();
  };

  const handlePushClick = async () => {
    try {
      setPushing(true);
      const repoId = getSelectedRepoId();
      if (!repoId) return;
      await git.actions.push({ repo_id: repoId });
      setPushSuccess(true);
      setTimeout(() => setPushSuccess(false), 2000);
    } finally {
      setPushing(false);
    }
  };

  const performMerge = async () => {
    try {
      setMerging(true);
      const repoId = getSelectedRepoId();
      if (!repoId) return;
      await git.actions.merge({
        repoId,
      });
      setMergeSuccess(true);
      setTimeout(() => setMergeSuccess(false), 2000);
    } finally {
      setMerging(false);
    }
  };

  const handleRebaseWithNewBranchAndUpstream = async (
    newBaseBranch: string,
    selectedUpstream: string
  ) => {
    setRebasing(true);
    try {
      const repoId = getSelectedRepoId();
      if (!repoId) return;
      await git.actions.rebase({
        repoId,
        newBaseBranch,
        oldBaseBranch: selectedUpstream,
      });
    } finally {
      setRebasing(false);
    }
  };

  const handleRebaseDialogOpen = async () => {
    try {
      const defaultTargetBranch = getSelectedRepoStatus()?.target_branch_name;
      const result = await RebaseDialog.show({
        branches,
        isRebasing: rebasing,
        initialTargetBranch: defaultTargetBranch,
        initialUpstreamBranch: defaultTargetBranch,
      });
      if (
        result.action === "confirmed" &&
        result.branchName &&
        result.upstreamBranch
      ) {
        await handleRebaseWithNewBranchAndUpstream(
          result.branchName,
          result.upstreamBranch
        );
      }
    } catch (error) {
      // User cancelled - do nothing
    }
  };

  const handlePRButtonClick = async () => {
    // If PR already exists, push to it
    if (mergeInfo.hasOpenPR) {
      await handlePushClick();
      return;
    }

    CreatePRDialog.show({
      attempt: selectedAttempt,
      task,
      repoId: getSelectedRepoId(),
      targetBranch: getSelectedRepoStatus()?.target_branch_name,
    });
  };

  const isVertical = layout === "vertical";

  const containerClasses = isVertical
    ? "grid grid-cols-1 items-start gap-3 overflow-hidden"
    : "flex items-center gap-2 overflow-hidden";

  const settingsBtnClasses = isVertical
    ? "inline-flex h-5 w-5 p-0 hover:bg-muted"
    : "hidden md:inline-flex h-5 w-5 p-0 hover:bg-muted";

  const actionsClasses = isVertical
    ? "flex flex-wrap items-center gap-2"
    : "shrink-0 flex flex-wrap items-center gap-2 overflow-y-hidden overflow-x-visible max-h-8";

  const statusChips = (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-xs">
      {(() => {
        const commitsAhead = selectedRepoStatus?.commits_ahead ?? 0;
        const commitsBehind = selectedRepoStatus?.commits_behind ?? 0;

        if (hasConflictsCalculated) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/60 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("git.status.conflicts")}
            </span>
          );
        }

        if (selectedRepoStatus?.is_rebase_in_progress) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/60 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              {t("git.states.rebasing")}
            </span>
          );
        }

        if (mergeInfo.hasMergedPR) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/70 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle className="h-3.5 w-3.5" />
              {t("git.states.merged")}
            </span>
          );
        }

        if (mergeInfo.hasOpenPR && mergeInfo.openPR?.type === "pr") {
          const prMerge = mergeInfo.openPR;
          return (
            <button
              aria-label={t("git.pr.open", {
                number: Number(prMerge.pr_info.number),
              })}
              className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full bg-sky-100/60 px-2 py-0.5 text-sky-700 hover:underline sm:max-w-none dark:bg-sky-900/30 dark:text-sky-300"
              onClick={() => window.open(prMerge.pr_info.url, "_blank")}
            >
              <GitPullRequest className="h-3.5 w-3.5" />
              {t("git.pr.number", {
                number: Number(prMerge.pr_info.number),
              })}
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          );
        }

        const chips: React.ReactNode[] = [];
        if (commitsAhead > 0) {
          chips.push(
            <span
              className="hidden items-center gap-1 rounded-full bg-emerald-100/70 px-2 py-0.5 text-emerald-700 sm:inline-flex dark:bg-emerald-900/30 dark:text-emerald-300"
              key="ahead"
            >
              +{commitsAhead} {t("git.status.commits", { count: commitsAhead })}{" "}
              {t("git.status.ahead")}
            </span>
          );
        }
        if (commitsBehind > 0) {
          chips.push(
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-100/60 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              key="behind"
            >
              {commitsBehind}{" "}
              {t("git.status.commits", { count: commitsBehind })}{" "}
              {t("git.status.behind")}
            </span>
          );
        }
        if (chips.length > 0)
          return <div className="flex items-center gap-2">{chips}</div>;

        return (
          <span className="hidden text-muted-foreground sm:inline">
            {t("git.status.upToDate")}
          </span>
        );
      })()}
    </div>
  );

  const branchChips = (
    <>
      {/* Task branch chip */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="hidden min-w-0 max-w-[280px] items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 font-medium text-xs sm:inline-flex">
              <GitBranchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedAttempt.branch}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("git.labels.taskBranch")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:inline" />

      {/* Target branch chip + change button */}
      <div className="flex min-w-0 items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex min-w-0 max-w-[280px] items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 font-medium text-xs">
                <GitBranchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {getSelectedRepoStatus()?.target_branch_name ||
                    selectedBranch ||
                    t("git.branch.current")}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("rebase.dialog.targetLabel")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("branches.changeTarget.dialog.title")}
                className={settingsBtnClasses}
                disabled={isAttemptRunning || hasConflictsCalculated}
                onClick={handleChangeTargetBranchDialogOpen}
                size="xs"
                variant="ghost"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("branches.changeTarget.dialog.title")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );

  return (
    <div className="w-full border-b py-2">
      <div className={containerClasses}>
        {isVertical ? (
          <>
            {repos.length > 1 && (
              <RepoSelector
                disabled={isAttemptRunning}
                onRepoSelect={setSelectedRepoId}
                placeholder={t("repos.selector.placeholder", "Select repo")}
                repos={repos}
                selectedRepoId={getSelectedRepoId() ?? null}
              />
            )}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {branchChips}
              {statusChips}
            </div>
          </>
        ) : (
          <>
            {repos.length > 0 && (
              <RepoSelector
                className="h-6 w-auto max-w-[200px] rounded-full border-0 bg-muted px-2 py-0.5 font-medium text-xs"
                disabled={isAttemptRunning}
                onRepoSelect={setSelectedRepoId}
                placeholder={t("repos.selector.placeholder", "Select repo")}
                repos={repos}
                selectedRepoId={getSelectedRepoId() ?? null}
              />
            )}
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden">
              <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                {branchChips}
              </div>
              {statusChips}
            </div>
          </>
        )}

        {/* Right: Actions */}
        {selectedRepoStatus && (
          <div className={actionsClasses}>
            <Button
              aria-label={mergeButtonLabel}
              className="shrink-0 gap-1 border-success text-success hover:bg-success"
              disabled={
                mergeInfo.hasMergedPR ||
                mergeInfo.hasOpenPR ||
                merging ||
                hasConflictsCalculated ||
                isAttemptRunning ||
                ((selectedRepoStatus?.commits_ahead ?? 0) === 0 &&
                  !pushSuccess &&
                  !mergeSuccess)
              }
              onClick={handleMergeClick}
              size="xs"
              variant="outline"
            >
              <GitBranchIcon className="h-3.5 w-3.5" />
              <span className="max-w-[10ch] truncate">{mergeButtonLabel}</span>
            </Button>

            <Button
              aria-label={prButtonLabel}
              className="shrink-0 gap-1 border-info text-info hover:bg-info"
              disabled={
                mergeInfo.hasMergedPR ||
                pushing ||
                isAttemptRunning ||
                hasConflictsCalculated ||
                (mergeInfo.hasOpenPR &&
                  (selectedRepoStatus?.remote_commits_ahead ?? 0) === 0) ||
                ((selectedRepoStatus?.commits_ahead ?? 0) === 0 &&
                  (selectedRepoStatus?.remote_commits_ahead ?? 0) === 0 &&
                  !pushSuccess &&
                  !mergeSuccess)
              }
              onClick={handlePRButtonClick}
              size="xs"
              variant="outline"
            >
              <GitPullRequest className="h-3.5 w-3.5" />
              <span className="max-w-[10ch] truncate">{prButtonLabel}</span>
            </Button>

            <Button
              aria-label={rebaseButtonLabel}
              className="shrink-0 gap-1 border-warning text-warning hover:bg-warning"
              disabled={rebasing || isAttemptRunning || hasConflictsCalculated}
              onClick={handleRebaseDialogOpen}
              size="xs"
              variant="outline"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${rebasing ? "animate-spin" : ""}`}
              />
              <span className="max-w-[10ch] truncate">{rebaseButtonLabel}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GitOperations;
