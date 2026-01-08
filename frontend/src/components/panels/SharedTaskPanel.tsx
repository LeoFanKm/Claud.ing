import { NewCardContent } from "@/components/ui/new-card";
import WYSIWYGEditor from "@/components/ui/wysiwyg";
import type { SharedTaskRecord } from "@/hooks/useProjectTasks";

interface SharedTaskPanelProps {
  task: SharedTaskRecord;
}

const SharedTaskPanel = ({ task }: SharedTaskPanelProps) => {
  return (
    <NewCardContent>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="break-words font-semibold text-xl leading-tight">
              {task.title}
            </h1>
          </div>
        </div>
        {task.description ? (
          <WYSIWYGEditor disabled value={task.description} />
        ) : null}
      </div>
    </NewCardContent>
  );
};

export default SharedTaskPanel;
