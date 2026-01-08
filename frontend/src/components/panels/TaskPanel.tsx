import { PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskWithAttemptStatus } from "shared/types";
import { CreateAttemptDialog } from "@/components/dialogs/tasks/CreateAttemptDialog";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import WYSIWYGEditor from "@/components/ui/wysiwyg";
import { useProject } from "@/contexts/ProjectContext";
import { useNavigateWithSearch } from "@/hooks";
import { useTaskAttemptWithSession } from "@/hooks/useTaskAttempt";
import { useTaskAttemptsWithSessions } from "@/hooks/useTaskAttempts";
import { paths } from "@/lib/paths";
import type { WorkspaceWithSession } from "@/types/attempt";
import { Button } from "../ui/button";
import { NewCardContent } from "../ui/new-card";

interface TaskPanelProps {
  task: TaskWithAttemptStatus | null;
}

const TaskPanel = ({ task }: TaskPanelProps) => {
  const { t } = useTranslation("tasks");
  const navigate = useNavigateWithSearch();
  const { projectId } = useProject();

  const {
    data: attempts = [],
    isLoading: isAttemptsLoading,
    isError: isAttemptsError,
  } = useTaskAttemptsWithSessions(task?.id);

  const { data: parentAttempt, isLoading: isParentLoading } =
    useTaskAttemptWithSession(task?.parent_workspace_id || undefined);

  const formatTimeAgo = (iso: string) => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const absSec = Math.round(Math.abs(diffMs) / 1000);

    const rtf =
      typeof Intl !== "undefined" &&
      typeof Intl.RelativeTimeFormat === "function"
        ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
        : null;

    const to = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
      rtf
        ? rtf.format(-value, unit)
        : `${value} ${unit}${value !== 1 ? "s" : ""} ago`;

    if (absSec < 60) return to(Math.round(absSec), "second");
    const mins = Math.round(absSec / 60);
    if (mins < 60) return to(mins, "minute");
    const hours = Math.round(mins / 60);
    if (hours < 24) return to(hours, "hour");
    const days = Math.round(hours / 24);
    if (days < 30) return to(days, "day");
    const months = Math.round(days / 30);
    if (months < 12) return to(months, "month");
    const years = Math.round(months / 12);
    return to(years, "year");
  };

  const displayedAttempts = [...attempts].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (!task) {
    return (
      <div className="text-muted-foreground">
        {t("taskPanel.noTaskSelected")}
      </div>
    );
  }

  const titleContent = `# ${task.title || "Task"}`;
  const descriptionContent = task.description || "";

  const attemptColumns: ColumnDef<WorkspaceWithSession>[] = [
    {
      id: "executor",
      header: "",
      accessor: (attempt) => attempt.session?.executor || "Base Agent",
      className: "pr-4",
    },
    {
      id: "branch",
      header: "",
      accessor: (attempt) => attempt.branch || "—",
      className: "pr-4",
    },
    {
      id: "time",
      header: "",
      accessor: (attempt) => formatTimeAgo(attempt.created_at),
      className: "pr-0 text-right",
    },
  ];

  return (
    <>
      <NewCardContent>
        <div className="flex h-full max-h-[calc(100vh-8rem)] flex-col p-6">
          <div className="min-h-0 flex-shrink space-y-3 overflow-y-auto">
            <WYSIWYGEditor disabled value={titleContent} />
            {descriptionContent && (
              <WYSIWYGEditor disabled value={descriptionContent} />
            )}
          </div>

          <div className="mt-6 flex-shrink-0 space-y-4">
            {task.parent_workspace_id && (
              <DataTable
                columns={attemptColumns}
                data={parentAttempt ? [parentAttempt] : []}
                headerContent="Parent Attempt"
                isLoading={isParentLoading}
                keyExtractor={(attempt) => attempt.id}
                onRowClick={(attempt) => {
                  if (projectId) {
                    navigate(
                      paths.attempt(projectId, attempt.task_id, attempt.id)
                    );
                  }
                }}
              />
            )}

            {isAttemptsLoading ? (
              <div className="text-muted-foreground">
                {t("taskPanel.loadingAttempts")}
              </div>
            ) : isAttemptsError ? (
              <div className="text-destructive">
                {t("taskPanel.errorLoadingAttempts")}
              </div>
            ) : (
              <DataTable
                columns={attemptColumns}
                data={displayedAttempts}
                emptyState={t("taskPanel.noAttempts")}
                headerContent={
                  <div className="flex w-full text-left">
                    <span className="flex-1">
                      {t("taskPanel.attemptsCount", {
                        count: displayedAttempts.length,
                      })}
                    </span>
                    <span>
                      <Button
                        onClick={() =>
                          CreateAttemptDialog.show({
                            taskId: task.id,
                          })
                        }
                        variant="icon"
                      >
                        <PlusIcon size={16} />
                      </Button>
                    </span>
                  </div>
                }
                keyExtractor={(attempt) => attempt.id}
                onRowClick={(attempt) => {
                  if (projectId && task.id) {
                    navigate(paths.attempt(projectId, task.id, attempt.id));
                  }
                }}
              />
            )}
          </div>
        </div>
      </NewCardContent>
    </>
  );
};

export default TaskPanel;
