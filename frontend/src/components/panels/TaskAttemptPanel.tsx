import type { ReactNode } from "react";
import type { TaskWithAttemptStatus } from "shared/types";
import VirtualizedList from "@/components/logs/VirtualizedList";
import { TaskFollowUpSection } from "@/components/tasks/TaskFollowUpSection";
import { EntriesProvider } from "@/contexts/EntriesContext";
import { RetryUiProvider } from "@/contexts/RetryUiContext";
import type { WorkspaceWithSession } from "@/types/attempt";

interface TaskAttemptPanelProps {
  attempt: WorkspaceWithSession | undefined;
  task: TaskWithAttemptStatus | null;
  children: (sections: { logs: ReactNode; followUp: ReactNode }) => ReactNode;
}

const TaskAttemptPanel = ({
  attempt,
  task,
  children,
}: TaskAttemptPanelProps) => {
  if (!attempt) {
    return <div className="p-6 text-muted-foreground">Loading attempt...</div>;
  }

  if (!task) {
    return <div className="p-6 text-muted-foreground">Loading task...</div>;
  }

  return (
    <EntriesProvider key={attempt.id}>
      <RetryUiProvider attemptId={attempt.id}>
        {children({
          logs: (
            <VirtualizedList attempt={attempt} key={attempt.id} task={task} />
          ),
          followUp: (
            <TaskFollowUpSection session={attempt.session} task={task} />
          ),
        })}
      </RetryUiProvider>
    </EntriesProvider>
  );
};

export default TaskAttemptPanel;
