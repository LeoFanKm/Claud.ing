/**
 * @file KanbanSection.tsx
 * @description Kanban board rendering section with empty states and drag-drop support
 *
 * @input columns (kanban data), handlers, selection state, filter state
 * @output Rendered kanban board or empty state UI
 * @position pages/ProjectTasks/KanbanSection
 */

import { Plus } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { TaskWithAttemptStatus } from "shared/types";
import TaskKanbanBoard, {
  type KanbanColumns,
} from "@/components/tasks/TaskKanbanBoard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DragEndEvent } from "@/components/ui/shadcn-io/kanban";
import type { SharedTaskRecord } from "@/hooks/useProjectTasks";

export interface KanbanSectionProps {
  // Core data
  columns: KanbanColumns;
  projectId: string;

  // Visibility flags
  hasTasks: boolean;
  hasSharedTasks: boolean;
  hasVisibleLocalTasks: boolean;
  hasVisibleSharedTasks: boolean;

  // Selection state
  selectedTaskId?: string;
  selectedSharedTaskId?: string | null;

  // Handlers
  onTaskSelect: (task: TaskWithAttemptStatus) => void;
  onSharedTaskSelect?: (task: SharedTaskRecord) => void;
  onTaskMove: (event: DragEndEvent) => void;
  onCreateTask: () => void;
}

function KanbanSectionInner({
  columns,
  projectId,
  hasTasks,
  hasSharedTasks,
  hasVisibleLocalTasks,
  hasVisibleSharedTasks,
  selectedTaskId,
  selectedSharedTaskId,
  onTaskSelect,
  onSharedTaskSelect,
  onTaskMove,
  onCreateTask,
}: KanbanSectionProps) {
  const { t } = useTranslation(["tasks"]);

  // Empty state: no tasks at all
  if (!(hasTasks || hasSharedTasks)) {
    return (
      <div className="mx-auto mt-8 max-w-7xl">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{t("empty.noTasks")}</p>
            <Button className="mt-4" onClick={onCreateTask}>
              <Plus className="mr-2 h-4 w-4" />
              {t("empty.createFirst")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state: no search results
  if (!(hasVisibleLocalTasks || hasVisibleSharedTasks)) {
    return (
      <div className="mx-auto mt-8 max-w-7xl">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {t("empty.noSearchResults")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal kanban board
  return (
    <div className="h-full w-full overflow-x-auto overflow-y-auto overscroll-x-contain">
      <TaskKanbanBoard
        columns={columns}
        onCreateTask={onCreateTask}
        onDragEnd={onTaskMove}
        onViewSharedTask={onSharedTaskSelect}
        onViewTaskDetails={onTaskSelect}
        projectId={projectId}
        selectedSharedTaskId={selectedSharedTaskId}
        selectedTaskId={selectedTaskId}
      />
    </div>
  );
}

export const KanbanSection = memo(KanbanSectionInner);
