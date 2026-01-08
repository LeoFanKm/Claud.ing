import { useCallback, useEffect, useRef } from "react";
import { KanbanCard } from "@/components/ui/shadcn-io/kanban";
import type { SharedTaskRecord } from "@/hooks/useProjectTasks";
import { TaskCardHeader } from "./TaskCardHeader";

interface SharedTaskCardProps {
  task: SharedTaskRecord;
  index: number;
  status: string;
  onViewDetails?: (task: SharedTaskRecord) => void;
  isSelected?: boolean;
}

export function SharedTaskCard({
  task,
  index,
  status,
  onViewDetails,
  isSelected,
}: SharedTaskCardProps) {
  const localRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    onViewDetails?.(task);
  }, [onViewDetails, task]);

  useEffect(() => {
    if (!(isSelected && localRef.current)) return;
    const el = localRef.current;
    requestAnimationFrame(() => {
      el.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });
    });
  }, [isSelected]);

  return (
    <KanbanCard
      className="relative overflow-hidden pl-5 before:absolute before:top-0 before:bottom-0 before:left-0 before:w-[3px] before:bg-muted-foreground before:content-['']"
      dragDisabled
      forwardedRef={localRef}
      id={`shared-${task.id}`}
      index={index}
      isOpen={isSelected}
      name={task.title}
      onClick={handleClick}
      parent={status}
    >
      <div className="flex flex-col gap-2">
        <TaskCardHeader
          avatar={{
            firstName: task.assignee_first_name ?? undefined,
            lastName: task.assignee_last_name ?? undefined,
            username: task.assignee_username ?? undefined,
          }}
          title={task.title}
        />
        {task.description && (
          <p className="break-words text-secondary-foreground text-sm">
            {task.description.length > 130
              ? `${task.description.substring(0, 130)}...`
              : task.description}
          </p>
        )}
      </div>
    </KanbanCard>
  );
}
