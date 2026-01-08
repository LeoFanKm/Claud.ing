import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Task, Workspace } from "shared/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ColumnDef, DataTable } from "@/components/ui/table/data-table";
import { useTaskRelationships } from "@/hooks/useTaskRelationships";
import { defineModal } from "@/lib/modals";
import { openTaskForm } from "@/lib/openTaskForm";

export interface ViewRelatedTasksDialogProps {
  attemptId: string;
  projectId: string;
  attempt: Workspace | null;
  onNavigateToTask?: (taskId: string) => void;
}

const ViewRelatedTasksDialogImpl =
  NiceModal.create<ViewRelatedTasksDialogProps>(
    ({ attemptId, projectId, attempt, onNavigateToTask }) => {
      const modal = useModal();
      const { t } = useTranslation("tasks");
      const {
        data: relationships,
        isLoading,
        isError,
        refetch,
      } = useTaskRelationships(attemptId);

      // Combine parent and children into a single list of related tasks
      const relatedTasks: Task[] = [];
      if (relationships?.parent_task) {
        relatedTasks.push(relationships.parent_task);
      }
      if (relationships?.children) {
        relatedTasks.push(...relationships.children);
      }

      const taskColumns: ColumnDef<Task>[] = [
        {
          id: "title",
          header: t("viewRelatedTasksDialog.columns.title"),
          accessor: (task) => (
            <div className="truncate" title={task.title}>
              {task.title || "—"}
            </div>
          ),
          className: "pr-4",
          headerClassName: "font-medium py-2 pr-4 w-1/2 bg-card",
        },
        {
          id: "description",
          header: t("viewRelatedTasksDialog.columns.description"),
          accessor: (task) => (
            <div
              className="line-clamp-1 text-muted-foreground"
              title={task.description || ""}
            >
              {task.description?.trim() ? task.description : "—"}
            </div>
          ),
          className: "pr-4",
          headerClassName: "font-medium py-2 pr-4 bg-card",
        },
      ];

      const handleOpenChange = (open: boolean) => {
        if (!open) {
          modal.hide();
        }
      };

      const handleClickTask = (taskId: string) => {
        onNavigateToTask?.(taskId);
        modal.hide();
      };

      const handleCreateSubtask = async () => {
        if (!(projectId && attempt)) return;

        // Close immediately - user intent is to create a subtask
        modal.hide();

        try {
          // Yield one microtask for smooth modal transition
          await Promise.resolve();

          await openTaskForm({
            mode: "subtask",
            projectId,
            parentTaskAttemptId: attempt.id,
            initialBaseBranch: attempt.branch,
          });
        } catch {
          // User cancelled or error occurred
        }
      };

      return (
        <Dialog
          className="w-[92vw] max-w-3xl overflow-x-hidden p-0"
          onOpenChange={handleOpenChange}
          open={modal.visible}
        >
          <DialogContent
            className="min-w-0 p-0"
            onKeyDownCapture={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                modal.hide();
              }
            }}
          >
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle>{t("viewRelatedTasksDialog.title")}</DialogTitle>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-auto p-4">
              {isError && (
                <div className="space-y-3 py-8 text-center">
                  <div className="text-destructive text-sm">
                    {t("viewRelatedTasksDialog.error")}
                  </div>
                  <Button onClick={() => refetch()} size="sm" variant="outline">
                    {t("common:buttons.retry")}
                  </Button>
                </div>
              )}

              {!isError && (
                <DataTable
                  columns={taskColumns}
                  data={relatedTasks}
                  emptyState={t("viewRelatedTasksDialog.empty")}
                  headerContent={
                    <div className="flex w-full text-left">
                      <span className="flex-1">
                        {t("viewRelatedTasksDialog.tasksCount", {
                          count: relatedTasks.length,
                        })}
                      </span>
                      <span>
                        <Button
                          disabled={!(projectId && attempt)}
                          onClick={handleCreateSubtask}
                          variant="icon"
                        >
                          <PlusIcon size={16} />
                        </Button>
                      </span>
                    </div>
                  }
                  isLoading={isLoading}
                  keyExtractor={(task) => task.id}
                  onRowClick={(task) => handleClickTask(task.id)}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      );
    }
  );

export const ViewRelatedTasksDialog = defineModal<
  ViewRelatedTasksDialogProps,
  void
>(ViewRelatedTasksDialogImpl);
