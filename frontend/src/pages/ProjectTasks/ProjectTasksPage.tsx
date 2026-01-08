/**
 * @file ProjectTasksPage.tsx
 * @description Main page component for project tasks - orchestrates routing and layout
 *
 * @position pages/ProjectTasks (main entry)
 */

import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useMemo } from "react";
import { useHotkeysContext } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type {
  RepoBranchStatus,
  TaskWithAttemptStatus,
  Workspace,
} from "shared/types";
import { useUserSystem } from "@/components/ConfigProvider";
import { FeatureShowcaseDialog } from "@/components/dialogs/global/FeatureShowcaseDialog";
import { type LayoutMode, TasksLayout } from "@/components/layout/TasksLayout";
import { DiffsPanel } from "@/components/panels/DiffsPanel";
import { PreviewPanel } from "@/components/panels/PreviewPanel";
import { KanbanSkeleton } from "@/components/tasks/KanbanSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { showcases } from "@/config/showcases";
import { ClickedElementsProvider } from "@/contexts/ClickedElementsProvider";
import { ExecutionProcessesProvider } from "@/contexts/ExecutionProcessesContext";
import {
  GitOperationsProvider,
  useGitOperationsError,
} from "@/contexts/GitOperationsContext";
import { useProject } from "@/contexts/ProjectContext";
import { ReviewProvider } from "@/contexts/ReviewProvider";
import { useSearch } from "@/contexts/SearchContext";
import { useAttemptExecution, useBranchStatus } from "@/hooks";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTaskAttemptWithSession } from "@/hooks/useTaskAttempt";
import { useTaskAttempts } from "@/hooks/useTaskAttempts";
import {
  Scope,
  useKeyCreate,
  useKeyCycleViewBackward,
  useKeyDeleteTask,
  useKeyExit,
  useKeyFocusSearch,
  useKeyNavDown,
  useKeyNavLeft,
  useKeyNavRight,
  useKeyNavUp,
  useKeyOpenDetails,
} from "@/keyboard";
import { openTaskForm } from "@/lib/openTaskForm";
import { paths } from "@/lib/paths";
import { KanbanSection } from "./KanbanSection";
import { TaskDetailContent, TaskDetailHeader } from "./TaskDetailSection";
import { useProjectTasksState } from "./useProjectTasksState";

// Diffs panel with execution status
function DiffsPanelContainer({
  attempt,
  selectedTask,
  branchStatus,
}: {
  attempt: Workspace | null;
  selectedTask: TaskWithAttemptStatus | null;
  branchStatus: RepoBranchStatus[] | null;
}) {
  const { isAttemptRunning } = useAttemptExecution(attempt?.id);
  return (
    <DiffsPanel
      gitOps={
        attempt && selectedTask
          ? {
              task: selectedTask,
              branchStatus: branchStatus ?? null,
              isAttemptRunning,
              selectedBranch: branchStatus?.[0]?.target_branch_name ?? null,
            }
          : undefined
      }
      key={attempt?.id}
      selectedAttempt={attempt}
    />
  );
}

export function ProjectTasksPage() {
  const { t } = useTranslation(["tasks", "common"]);
  const { attemptId } = useParams<{
    projectId: string;
    taskId?: string;
    attemptId?: string;
  }>();
  const navigate = useNavigate();
  const { enableScope, disableScope, activeScopes } = useHotkeysContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = !useMediaQuery("(min-width: 1280px)");
  const posthog = usePostHog();
  const { focusInput } = useSearch();
  const { isLoading: projectLoading, error: projectError } = useProject();
  const { error: gitError } = useGitOperationsError();

  // State management
  const { state, actions } = useProjectTasksState();
  const {
    tasks,
    selectedTask,
    selectedSharedTask,
    selectedSharedTaskId,
    setSelectedSharedTaskId,
    isPanelOpen,
    kanbanColumns,
    hasVisibleLocalTasks,
    hasVisibleSharedTasks,
    hasSharedTasks,
    isLoading,
    streamError,
    connection,
    reconnectCountdown,
    reconnect,
    projectId,
    taskId,
  } = state;
  const {
    handleViewTaskDetails,
    handleViewSharedTask,
    handleClosePanel,
    handleDragEnd,
    selectNextTask,
    selectPreviousTask,
    selectNextColumn,
    selectPreviousColumn,
    navigateWithSearch,
    getSharedTask,
  } = actions;

  // Scopes
  useEffect(() => {
    enableScope(Scope.KANBAN);
    return () => disableScope(Scope.KANBAN);
  }, [enableScope, disableScope]);

  // Feature showcase
  const { config, updateAndSaveConfig, loading } = useUserSystem();
  const seenFeatures = useMemo(
    () => config?.showcases?.seen_features ?? [],
    [config?.showcases?.seen_features]
  );
  const seen = !loading && seenFeatures.includes(showcases.taskPanel.id);
  useEffect(() => {
    if (loading || !isPanelOpen || seen) return;
    FeatureShowcaseDialog.show({ config: showcases.taskPanel }).finally(() => {
      FeatureShowcaseDialog.hide();
      if (!seenFeatures.includes(showcases.taskPanel.id)) {
        void updateAndSaveConfig({
          showcases: {
            seen_features: [...seenFeatures, showcases.taskPanel.id],
          },
        });
      }
    });
  }, [loading, isPanelOpen, seen, seenFeatures, updateAndSaveConfig]);

  // Latest attempt redirect
  const isLatest = attemptId === "latest";
  const { data: attempts = [], isLoading: isAttemptsLoading } = useTaskAttempts(
    taskId,
    { enabled: !!taskId && isLatest }
  );
  const latestAttemptId = useMemo(() => {
    if (!attempts?.length) return undefined;
    return [...attempts].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
        a.id.localeCompare(b.id)
    )[0].id;
  }, [attempts]);

  useEffect(() => {
    if (!(projectId && taskId && isLatest) || isAttemptsLoading) return;
    if (latestAttemptId)
      navigateWithSearch(paths.attempt(projectId, taskId, latestAttemptId), {
        replace: true,
      });
    else navigateWithSearch(paths.task(projectId, taskId), { replace: true });
  }, [
    projectId,
    taskId,
    isLatest,
    isAttemptsLoading,
    latestAttemptId,
    navigateWithSearch,
  ]);

  useEffect(() => {
    if (!(projectId && taskId) || isLoading) return;
    if (selectedTask === null)
      navigate(`/projects/${projectId}/tasks`, { replace: true });
  }, [projectId, taskId, isLoading, selectedTask, navigate]);

  // Attempt data
  const effectiveAttemptId = attemptId === "latest" ? undefined : attemptId;
  const isTaskView = !!taskId && !effectiveAttemptId;
  const { data: attempt } = useTaskAttemptWithSession(effectiveAttemptId);
  const { data: branchStatus } = useBranchStatus(attempt?.id);

  // View mode
  const rawMode = searchParams.get("view") as LayoutMode;
  const mode: LayoutMode =
    rawMode === "preview" || rawMode === "diffs" ? rawMode : null;
  useEffect(() => {
    if (searchParams.get("view") === "logs") {
      const p = new URLSearchParams(searchParams);
      p.set("view", "diffs");
      setSearchParams(p, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const setMode = useCallback(
    (m: LayoutMode) => {
      const p = new URLSearchParams(searchParams);
      m === null ? p.delete("view") : p.set("view", m);
      setSearchParams(p, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Keyboard shortcuts
  const handleCreateTask = useCallback(() => {
    if (projectId) openTaskForm({ mode: "create", projectId });
  }, [projectId]);
  useKeyCreate(handleCreateTask, { scope: Scope.KANBAN, preventDefault: true });
  useKeyFocusSearch(() => focusInput(), {
    scope: Scope.KANBAN,
    preventDefault: true,
  });
  useKeyExit(
    () => {
      isPanelOpen ? handleClosePanel() : navigate("/projects");
    },
    { scope: Scope.KANBAN }
  );
  useKeyNavUp(() => selectPreviousTask(), {
    scope: Scope.KANBAN,
    preventDefault: true,
  });
  useKeyNavDown(() => selectNextTask(), {
    scope: Scope.KANBAN,
    preventDefault: true,
  });
  useKeyNavLeft(() => selectPreviousColumn(), {
    scope: Scope.KANBAN,
    preventDefault: true,
  });
  useKeyNavRight(() => selectNextColumn(), {
    scope: Scope.KANBAN,
    preventDefault: true,
  });
  useKeyDeleteTask(() => {}, { scope: Scope.KANBAN, preventDefault: true });

  const cycleView = useCallback(
    (dir: "forward" | "backward") => {
      const order: LayoutMode[] = [null, "preview", "diffs"];
      const idx = order.indexOf(mode);
      const next =
        dir === "forward"
          ? order[(idx + 1) % order.length]
          : order[(idx - 1 + order.length) % order.length];
      if (next === "preview")
        posthog?.capture("preview_navigated", {
          trigger: "keyboard",
          direction: dir,
        });
      else if (next === "diffs")
        posthog?.capture("diffs_navigated", {
          trigger: "keyboard",
          direction: dir,
        });
      setMode(next);
    },
    [mode, setMode, posthog]
  );

  const isFollowUpActive = activeScopes.includes(Scope.FOLLOW_UP_READY);
  useKeyOpenDetails(
    () => {
      isPanelOpen
        ? cycleView("forward")
        : selectedTask && handleViewTaskDetails(selectedTask);
    },
    { scope: Scope.KANBAN, when: () => !isFollowUpActive }
  );
  useKeyCycleViewBackward(
    () => {
      if (isPanelOpen) cycleView("backward");
    },
    { scope: Scope.KANBAN, preventDefault: true }
  );

  // Handlers for TaskDetail
  const handleClose = useCallback(
    () => navigate(`/projects/${projectId}/tasks`, { replace: true }),
    [navigate, projectId]
  );
  const handleCloseSharedTask = useCallback(() => {
    setSelectedSharedTaskId(null);
    if (projectId)
      navigateWithSearch(paths.projectTasks(projectId), { replace: true });
  }, [setSelectedSharedTaskId, projectId, navigateWithSearch]);
  const handleNavigateToTask = useCallback(
    () => navigateWithSearch(paths.task(projectId!, taskId!)),
    [navigateWithSearch, projectId, taskId]
  );

  // Error states
  if (projectError)
    return (
      <div className="p-4">
        <Alert>
          <AlertTitle className="flex items-center gap-2">
            <AlertTriangle size="16" />
            {t("common:states.error")}
          </AlertTitle>
          <AlertDescription>
            {projectError.message || "Failed to load project"}
          </AlertDescription>
        </Alert>
      </div>
    );
  if (projectLoading && isLoading && tasks.length === 0)
    return (
      <div className="h-full">
        <KanbanSkeleton />
      </div>
    );

  const effectiveMode: LayoutMode = selectedSharedTask ? null : mode;
  const showReconnect =
    connection.status === "reconnecting" || connection.status === "error";

  return (
    <div className="flex h-full min-h-full flex-col">
      {showReconnect && (
        <Alert
          className="z-30 w-full xl:sticky xl:top-0"
          variant={connection.status === "error" ? "destructive" : "default"}
        >
          <AlertTitle className="flex items-center gap-2">
            {connection.status === "error" ? (
              <WifiOff size="16" />
            ) : (
              <AlertTriangle size="16" />
            )}
            {connection.status === "error"
              ? t("common:states.maxAttemptsReached")
              : reconnectCountdown !== null
                ? t("common:states.reconnectingWithCountdown", {
                    seconds: reconnectCountdown,
                  })
                : t("common:states.reconnecting")}
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{streamError || t("common:states.connectionLost")}</span>
            <Button
              className="ml-4 shrink-0"
              onClick={reconnect}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="mr-1" size="14" />
              {t("common:states.retryNow")}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="min-h-0 flex-1">
        <GitOperationsProvider attemptId={attempt?.id}>
          <ClickedElementsProvider attempt={attempt}>
            <ReviewProvider attemptId={attempt?.id}>
              <ExecutionProcessesProvider attemptId={attempt?.id}>
                <TasksLayout
                  attempt={
                    <TaskDetailContent
                      attempt={attempt}
                      gitError={gitError}
                      isTaskView={isTaskView}
                      selectedSharedTask={selectedSharedTask}
                      selectedTask={selectedTask}
                    />
                  }
                  aux={
                    selectedTask && attempt ? (
                      <div className="relative h-full w-full">
                        {mode === "preview" && <PreviewPanel />}
                        {mode === "diffs" && (
                          <DiffsPanelContainer
                            attempt={attempt}
                            branchStatus={branchStatus ?? null}
                            selectedTask={selectedTask}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="relative h-full w-full" />
                    )
                  }
                  isMobile={isMobile}
                  isPanelOpen={isPanelOpen}
                  kanban={
                    <KanbanSection
                      columns={kanbanColumns}
                      hasSharedTasks={hasSharedTasks}
                      hasTasks={tasks.length > 0}
                      hasVisibleLocalTasks={hasVisibleLocalTasks}
                      hasVisibleSharedTasks={hasVisibleSharedTasks}
                      onCreateTask={handleCreateTask}
                      onSharedTaskSelect={handleViewSharedTask}
                      onTaskMove={handleDragEnd}
                      onTaskSelect={handleViewTaskDetails}
                      projectId={projectId!}
                      selectedSharedTaskId={selectedSharedTaskId}
                      selectedTaskId={selectedTask?.id}
                    />
                  }
                  mode={effectiveMode}
                  onClose={handleClose}
                  rightHeader={
                    <TaskDetailHeader
                      attempt={attempt}
                      getSharedTask={getSharedTask}
                      isTaskView={isTaskView}
                      mode={mode}
                      onClose={handleClose}
                      onCloseSharedTask={handleCloseSharedTask}
                      onModeChange={setMode}
                      onNavigateToTask={handleNavigateToTask}
                      selectedSharedTask={selectedSharedTask}
                      selectedTask={selectedTask}
                    />
                  }
                />
              </ExecutionProcessesProvider>
            </ReviewProvider>
          </ClickedElementsProvider>
        </GitOperationsProvider>
      </div>
    </div>
  );
}

export default ProjectTasksPage;
