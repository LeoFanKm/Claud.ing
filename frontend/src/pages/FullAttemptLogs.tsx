// VS Code webview integration - install keyboard/clipboard bridge
import "@/vscode/bridge";

import { useParams } from "react-router-dom";
import TaskAttemptPanel from "@/components/panels/TaskAttemptPanel";
import { ClickedElementsProvider } from "@/contexts/ClickedElementsProvider";
import { ExecutionProcessesProvider } from "@/contexts/ExecutionProcessesContext";
import { ReviewProvider } from "@/contexts/ReviewProvider";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import { useTaskAttemptWithSession } from "@/hooks/useTaskAttempt";
import { AppWithStyleOverride } from "@/utils/StyleOverride";
import { WebviewContextMenu } from "@/vscode/ContextMenu";

export function FullAttemptLogsPage() {
  const {
    projectId = "",
    taskId = "",
    attemptId = "",
  } = useParams<{
    projectId: string;
    taskId: string;
    attemptId: string;
  }>();

  const { data: attempt } = useTaskAttemptWithSession(attemptId);
  const { tasksById } = useProjectTasks(projectId);
  const task = taskId ? (tasksById[taskId] ?? null) : null;

  return (
    <AppWithStyleOverride>
      <div className="flex h-screen flex-col bg-muted">
        <WebviewContextMenu />

        <main className="min-h-0 flex-1">
          {attempt ? (
            <ClickedElementsProvider attempt={attempt}>
              <ReviewProvider key={attempt.id}>
                <ExecutionProcessesProvider
                  attemptId={attempt.id}
                  key={attempt.id}
                >
                  <TaskAttemptPanel attempt={attempt} task={task}>
                    {({ logs, followUp }) => (
                      <div className="flex h-full min-h-0 flex-col">
                        <div className="flex min-h-0 flex-1 flex-col">
                          {logs}
                        </div>
                        <div className="max-h-[50%] min-h-0 overflow-hidden border-t">
                          <div className="mx-auto h-full min-h-0 w-full max-w-[50rem]">
                            {followUp}
                          </div>
                        </div>
                      </div>
                    )}
                  </TaskAttemptPanel>
                </ExecutionProcessesProvider>
              </ReviewProvider>
            </ClickedElementsProvider>
          ) : (
            <TaskAttemptPanel attempt={attempt} task={task}>
              {({ logs, followUp }) => (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col">{logs}</div>
                  <div className="max-h-[50%] min-h-0 overflow-hidden border-t">
                    <div className="mx-auto h-full min-h-0 w-full max-w-[50rem]">
                      {followUp}
                    </div>
                  </div>
                </div>
              )}
            </TaskAttemptPanel>
          )}
        </main>
      </div>
    </AppWithStyleOverride>
  );
}
