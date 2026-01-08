import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Copy,
  FileDiff,
  GitBranch,
  Pause,
  Play,
  Settings,
  Terminal,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  BaseAgentCapability,
  type BaseCodingAgent,
  type TaskWithAttemptStatus,
} from "shared/types";
import { useUserSystem } from "@/components/ConfigProvider";
import { CreateAttemptDialog } from "@/components/dialogs/tasks/CreateAttemptDialog";
import { GitActionsDialog } from "@/components/dialogs/tasks/GitActionsDialog";
import { ViewProcessesDialog } from "@/components/dialogs/tasks/ViewProcessesDialog";
import { getIdeName, IdeIcon } from "@/components/ide/IdeIcon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProject } from "@/contexts/ProjectContext";
import { useDevServer } from "@/hooks/useDevServer";
import { useDiffSummary } from "@/hooks/useDiffSummary";
import { useOpenInEditor } from "@/hooks/useOpenInEditor";
import { attemptsApi } from "@/lib/api";

type NextActionCardProps = {
  attemptId?: string;
  containerRef?: string | null;
  failed: boolean;
  execution_processes: number;
  task?: TaskWithAttemptStatus;
  needsSetup?: boolean;
};

export function NextActionCard({
  attemptId,
  containerRef,
  failed,
  execution_processes,
  task,
  needsSetup,
}: NextActionCardProps) {
  const { t } = useTranslation("tasks");
  const { config } = useUserSystem();
  const { project } = useProject();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data: attempt } = useQuery({
    queryKey: ["attemptWithSession", attemptId],
    queryFn: () => attemptsApi.getWithSession(attemptId!),
    enabled: !!attemptId && failed,
  });
  const { capabilities } = useUserSystem();

  const openInEditor = useOpenInEditor(attemptId);
  const { fileCount, added, deleted, error } = useDiffSummary(
    attemptId ?? null
  );
  const {
    start,
    stop,
    isStarting,
    isStopping,
    runningDevServer,
    latestDevServerProcess,
  } = useDevServer(attemptId);

  const projectHasDevScript = Boolean(project?.dev_script);

  const handleCopy = useCallback(async () => {
    if (!containerRef) return;

    try {
      await navigator.clipboard.writeText(containerRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Copy to clipboard failed:", err);
    }
  }, [containerRef]);

  const handleOpenInEditor = useCallback(() => {
    openInEditor();
  }, [openInEditor]);

  const handleViewLogs = useCallback(() => {
    if (attemptId) {
      ViewProcessesDialog.show({
        attemptId,
        initialProcessId: latestDevServerProcess?.id,
      });
    }
  }, [attemptId, latestDevServerProcess?.id]);

  const handleOpenDiffs = useCallback(() => {
    navigate({ search: "?view=diffs" });
  }, [navigate]);

  const handleTryAgain = useCallback(() => {
    if (!attempt?.task_id) return;
    CreateAttemptDialog.show({
      taskId: attempt.task_id,
    });
  }, [attempt?.task_id]);

  const handleGitActions = useCallback(() => {
    if (!attemptId) return;
    GitActionsDialog.show({
      attemptId,
      task,
    });
  }, [attemptId, task]);

  const handleRunSetup = useCallback(async () => {
    if (!(attemptId && attempt?.session?.executor)) return;
    try {
      await attemptsApi.runAgentSetup(attemptId, {
        executor_profile_id: {
          executor: attempt.session.executor as BaseCodingAgent,
          variant: null,
        },
      });
    } catch (error) {
      console.error("Failed to run setup:", error);
    }
  }, [attemptId, attempt]);

  const canAutoSetup = !!(
    attempt?.session?.executor &&
    capabilities?.[attempt.session.executor]?.includes(
      BaseAgentCapability.SETUP_HELPER
    )
  );

  const setupHelpText = canAutoSetup
    ? t("attempt.setupHelpText", { agent: attempt?.session?.executor })
    : null;

  const editorName = getIdeName(config?.editor?.editor_type);

  // Necessary to prevent this component being displayed beyond fold within Virtualised List
  if (
    (!failed || (execution_processes > 2 && !needsSetup)) &&
    fileCount === 0
  ) {
    return <div className="h-24" />;
  }

  return (
    <TooltipProvider>
      <div className="pt-4 pb-8">
        <div
          className={`flex px-3 py-1 text-background ${failed ? "bg-destructive" : "bg-foreground"}`}
        >
          <span className="flex-1 font-semibold">
            {t("attempt.labels.summaryAndActions")}
          </span>
        </div>

        {/* Display setup help text when setup is needed */}
        {needsSetup && setupHelpText && (
          <div
            className={`border-x border-t ${failed ? "border-destructive" : "border-foreground"} flex items-start gap-2 px-3 py-2`}
          >
            <Settings className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{setupHelpText}</span>
          </div>
        )}

        <div
          className={`flex min-w-0 flex-col gap-2 border px-3 py-2 sm:flex-row sm:items-center sm:gap-3 ${failed ? "border-destructive" : "border-foreground"} ${needsSetup && setupHelpText ? "border-t-0" : ""}`}
        >
          {/* Left: Diff summary */}
          {!error && (
            <button
              aria-label={t("attempt.diffs")}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm transition-all hover:underline"
              onClick={handleOpenDiffs}
            >
              <span>{t("diff.filesChanged", { count: fileCount })}</span>
              <span className="opacity-50">•</span>
              <span className="text-green-600 dark:text-green-400">
                +{added}
              </span>
              <span className="opacity-50">•</span>
              <span className="text-red-600 dark:text-red-400">-{deleted}</span>
            </button>
          )}

          {/* Run Setup or Try Again button */}
          {failed &&
            (needsSetup ? (
              <Button
                aria-label={t("attempt.runSetup")}
                className="w-full text-sm sm:w-auto"
                disabled={!attempt}
                onClick={handleRunSetup}
                size="sm"
                variant="default"
              >
                {t("attempt.runSetup")}
              </Button>
            ) : (
              execution_processes <= 2 && (
                <Button
                  aria-label={t("attempt.tryAgain")}
                  className="w-full text-sm sm:w-auto"
                  disabled={!attempt?.task_id}
                  onClick={handleTryAgain}
                  size="sm"
                  variant="destructive"
                >
                  {t("attempt.tryAgain")}
                </Button>
              )
            ))}

          {/* Right: Icon buttons */}
          {fileCount > 0 && (
            <div className="flex shrink-0 items-center gap-1 sm:ml-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t("attempt.diffs")}
                    className="h-7 w-7 p-0"
                    onClick={handleOpenDiffs}
                    size="sm"
                    variant="ghost"
                  >
                    <FileDiff className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("attempt.diffs")}</TooltipContent>
              </Tooltip>

              {containerRef && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={t("attempt.clickToCopy")}
                      className="h-7 w-7 p-0"
                      onClick={handleCopy}
                      size="sm"
                      variant="ghost"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {copied ? t("attempt.copied") : t("attempt.clickToCopy")}
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t("attempt.openInEditor", {
                      editor: editorName,
                    })}
                    className="h-7 w-7 p-0"
                    disabled={!attemptId}
                    onClick={handleOpenInEditor}
                    size="sm"
                    variant="ghost"
                  >
                    <IdeIcon
                      className="h-3.5 w-3.5"
                      editorType={config?.editor?.editor_type}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t("attempt.openInEditor", { editor: editorName })}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      aria-label={
                        runningDevServer
                          ? t("attempt.pauseDev")
                          : t("attempt.startDev")
                      }
                      className="h-7 w-7 p-0"
                      disabled={
                        (runningDevServer ? isStopping : isStarting) ||
                        !attemptId ||
                        !projectHasDevScript
                      }
                      onClick={runningDevServer ? () => stop() : () => start()}
                      size="sm"
                      variant="ghost"
                    >
                      {runningDevServer ? (
                        <Pause className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {projectHasDevScript
                    ? runningDevServer
                      ? t("attempt.pauseDev")
                      : t("attempt.startDev")
                    : t("attempt.devScriptMissingTooltip")}
                </TooltipContent>
              </Tooltip>

              {latestDevServerProcess && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={t("attempt.viewDevLogs")}
                      className="h-7 w-7 p-0"
                      disabled={!attemptId}
                      onClick={handleViewLogs}
                      size="sm"
                      variant="ghost"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("attempt.viewDevLogs")}</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t("attempt.gitActions")}
                    className="h-7 w-7 p-0"
                    disabled={!attemptId}
                    onClick={handleGitActions}
                    size="sm"
                    variant="ghost"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("attempt.gitActions")}</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
