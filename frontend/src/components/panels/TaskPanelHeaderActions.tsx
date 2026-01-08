import { X } from "lucide-react";
import type { TaskWithAttemptStatus } from "shared/types";
import type { SharedTaskRecord } from "@/hooks/useProjectTasks";
import { ActionsDropdown } from "../ui/actions-dropdown";
import { Button } from "../ui/button";

type Task = TaskWithAttemptStatus;

interface TaskPanelHeaderActionsProps {
  task: Task;
  sharedTask?: SharedTaskRecord;
  onClose: () => void;
}

export const TaskPanelHeaderActions = ({
  task,
  sharedTask,
  onClose,
}: TaskPanelHeaderActionsProps) => {
  return (
    <>
      <ActionsDropdown sharedTask={sharedTask} task={task} />
      <Button aria-label="Close" onClick={onClose} variant="icon">
        <X size={16} />
      </Button>
    </>
  );
};
