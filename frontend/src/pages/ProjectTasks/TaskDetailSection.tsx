/**
 * @file TaskDetailSection.tsx
 * @description Task detail panel component for rendering task/attempt content
 *
 * @input selectedTask, selectedSharedTask, attempt, mode, onClose
 * @output Rendered task detail panel with header and content
 * @position pages/ProjectTasks
 */

import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskWithAttemptStatus } from "shared/types";
import type { LayoutMode } from "@/components/layout/TasksLayout";
import { AttemptHeaderActions } from "@/components/panels/AttemptHeaderActions";
import SharedTaskPanel from "@/components/panels/SharedTaskPanel";
import TaskAttemptPanel from "@/components/panels/TaskAttemptPanel";
import TaskPanel from "@/components/panels/TaskPanel";
import { TaskPanelHeaderActions } from "@/components/panels/TaskPanelHeaderActions";
import TodoPanel from "@/components/tasks/TodoPanel";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { NewCard, NewCardHeader } from "@/components/ui/new-card";
import type { SharedTaskRecord } from "@/hooks/useProjectTasks";
import type { WorkspaceWithSession } from "@/types/attempt";

function GitErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <div className="mx-4 mt-4 rounded border border-destructive p-3">
      <div className="text-destructive text-sm">{error}</div>
    </div>
  );
}

export interface TaskDetailSectionProps {
  // Core data
  selectedTask: TaskWithAttemptStatus | null;
  selectedSharedTask: SharedTaskRecord | null;
  attempt: WorkspaceWithSession | undefined;

  // View state
  mode: LayoutMode;
  isTaskView: boolean;

  // Actions
  onClose: () => void;
  onModeChange: (mode: LayoutMode) => void;
  onNavigateToTask: () => void;
  onCloseSharedTask: () => void;

  // Utilities
  getSharedTask: (
    task: TaskWithAttemptStatus | null
  ) => SharedTaskRecord | undefined;

  // Git error (optional)
  gitError?: string | null;
}

/**
 * Truncates a title to a maximum length, breaking at word boundaries
 */
function truncateTitle(title: string | undefined, maxLength = 20): string {
  if (!title) return "Task";
  if (title.length <= maxLength) return title;

  const truncated = title.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  return lastSpace > 0
    ? `${truncated.substring(0, lastSpace)}...`
    : `${truncated}...`;
}

/**
 * Task detail section header component
 */
export function TaskDetailHeader({
  selectedTask,
  selectedSharedTask,
  attempt,
  mode,
  isTaskView,
  onClose,
  onModeChange,
  onNavigateToTask,
  onCloseSharedTask,
  getSharedTask,
}: Omit<TaskDetailSectionProps, "gitError">) {
  const { t } = useTranslation("common");

  if (selectedTask) {
    return (
      <NewCardHeader
        actions={
          isTaskView ? (
            <TaskPanelHeaderActions
              onClose={onClose}
              sharedTask={getSharedTask(selectedTask)}
              task={selectedTask}
            />
          ) : (
            <AttemptHeaderActions
              attempt={attempt ?? null}
              mode={mode}
              onClose={onClose}
              onModeChange={onModeChange}
              sharedTask={getSharedTask(selectedTask)}
              task={selectedTask}
            />
          )
        }
        className="shrink-0"
      >
        <div className="mx-auto w-full">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                {isTaskView ? (
                  <BreadcrumbPage>
                    {truncateTitle(selectedTask?.title)}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer hover:underline"
                    onClick={onNavigateToTask}
                  >
                    {truncateTitle(selectedTask?.title)}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isTaskView && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {attempt?.branch || "Task Attempt"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </NewCardHeader>
    );
  }

  if (selectedSharedTask) {
    return (
      <NewCardHeader
        actions={
          <Button
            aria-label={t("buttons.close", { defaultValue: "Close" })}
            onClick={onCloseSharedTask}
            variant="icon"
          >
            <X size={16} />
          </Button>
        }
        className="shrink-0"
      >
        <div className="mx-auto w-full">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {truncateTitle(selectedSharedTask?.title)}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </NewCardHeader>
    );
  }

  return null;
}

/**
 * Task detail section content component
 */
export function TaskDetailContent({
  selectedTask,
  selectedSharedTask,
  attempt,
  isTaskView,
  gitError,
}: Pick<
  TaskDetailSectionProps,
  "selectedTask" | "selectedSharedTask" | "attempt" | "isTaskView" | "gitError"
>) {
  if (selectedTask) {
    return (
      <NewCard className="flex h-full min-h-0 flex-col border-0 bg-diagonal-lines bg-muted">
        {isTaskView ? (
          <TaskPanel task={selectedTask} />
        ) : (
          <TaskAttemptPanel attempt={attempt} task={selectedTask}>
            {({ logs, followUp }) => (
              <>
                <GitErrorBanner error={gitError ?? null} />
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col">{logs}</div>

                  <div className="shrink-0 border-t">
                    <div className="mx-auto w-full max-w-[50rem]">
                      <TodoPanel />
                    </div>
                  </div>

                  <div className="max-h-[50%] min-h-0 overflow-hidden border-t bg-background">
                    <div className="mx-auto h-full min-h-0 w-full max-w-[50rem]">
                      {followUp}
                    </div>
                  </div>
                </div>
              </>
            )}
          </TaskAttemptPanel>
        )}
      </NewCard>
    );
  }

  if (selectedSharedTask) {
    return (
      <NewCard className="flex h-full min-h-0 flex-col border-0 bg-diagonal-lines bg-muted">
        <SharedTaskPanel task={selectedSharedTask} />
      </NewCard>
    );
  }

  return null;
}

/**
 * Combined task detail section component
 * Renders both header and content for task/attempt detail panel
 */
export function TaskDetailSection(props: TaskDetailSectionProps) {
  return {
    header: <TaskDetailHeader {...props} />,
    content: <TaskDetailContent {...props} />,
  };
}

export default TaskDetailSection;
