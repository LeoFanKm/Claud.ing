import { memo } from "react";
import type { TaskStatus, TaskWithAttemptStatus } from "shared/types";
import {
  type DragEndEvent,
  KanbanBoard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "@/components/ui/shadcn-io/kanban";
import { useAuth } from "@/hooks";
import type { SharedTaskRecord } from "@/hooks/useProjectTasks";
import { statusBoardColors, statusLabels } from "@/utils/statusLabels";
import { SharedTaskCard } from "./SharedTaskCard";
import { TaskCard } from "./TaskCard";

export type KanbanColumnItem =
  | {
      type: "task";
      task: TaskWithAttemptStatus;
      sharedTask?: SharedTaskRecord;
    }
  | {
      type: "shared";
      task: SharedTaskRecord;
    };

export type KanbanColumns = Record<TaskStatus, KanbanColumnItem[]>;

interface TaskKanbanBoardProps {
  columns: KanbanColumns;
  onDragEnd: (event: DragEndEvent) => void;
  onViewTaskDetails: (task: TaskWithAttemptStatus) => void;
  onViewSharedTask?: (task: SharedTaskRecord) => void;
  selectedTaskId?: string;
  selectedSharedTaskId?: string | null;
  onCreateTask?: () => void;
  projectId: string;
}

function TaskKanbanBoard({
  columns,
  onDragEnd,
  onViewTaskDetails,
  onViewSharedTask,
  selectedTaskId,
  selectedSharedTaskId,
  onCreateTask,
  projectId,
}: TaskKanbanBoardProps) {
  const { userId } = useAuth();

  return (
    <KanbanProvider onDragEnd={onDragEnd}>
      {Object.entries(columns).map(([status, items]) => {
        const statusKey = status as TaskStatus;
        return (
          <KanbanBoard id={statusKey} key={status}>
            <KanbanHeader
              color={statusBoardColors[statusKey]}
              name={statusLabels[statusKey]}
              onAddTask={onCreateTask}
            />
            <KanbanCards>
              {items.map((item, index) => {
                const isOwnTask =
                  item.type === "task" &&
                  (!(item.sharedTask?.assignee_user_id && userId) ||
                    item.sharedTask?.assignee_user_id === userId);

                if (isOwnTask) {
                  return (
                    <TaskCard
                      index={index}
                      isOpen={selectedTaskId === item.task.id}
                      key={item.task.id}
                      onViewDetails={onViewTaskDetails}
                      projectId={projectId}
                      sharedTask={item.sharedTask}
                      status={statusKey}
                      task={item.task}
                    />
                  );
                }

                const sharedTask =
                  item.type === "shared" ? item.task : item.sharedTask!;

                return (
                  <SharedTaskCard
                    index={index}
                    isSelected={selectedSharedTaskId === item.task.id}
                    key={`shared-${item.task.id}`}
                    onViewDetails={onViewSharedTask}
                    status={statusKey}
                    task={sharedTask}
                  />
                );
              })}
            </KanbanCards>
          </KanbanBoard>
        );
      })}
    </KanbanProvider>
  );
}

export default memo(TaskKanbanBoard);
