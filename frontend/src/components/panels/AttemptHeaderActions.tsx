import { Eye, FileDiff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskWithAttemptStatus, Workspace } from "shared/types";
import type { SharedTaskRecord } from "@/hooks/useProjectTasks";
import type { LayoutMode } from "../layout/TasksLayout";
import { ActionsDropdown } from "../ui/actions-dropdown";
import { Button } from "../ui/button";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface AttemptHeaderActionsProps {
  onClose: () => void;
  mode?: LayoutMode;
  onModeChange?: (mode: LayoutMode) => void;
  task: TaskWithAttemptStatus;
  attempt?: Workspace | null;
  sharedTask?: SharedTaskRecord;
}

export const AttemptHeaderActions = ({
  onClose,
  mode,
  onModeChange,
  task,
  attempt,
  sharedTask,
}: AttemptHeaderActionsProps) => {
  const { t } = useTranslation("tasks");

  return (
    <>
      {typeof mode !== "undefined" && onModeChange && (
        <TooltipProvider>
          <ToggleGroup
            aria-label="Layout mode"
            className="inline-flex gap-4"
            onValueChange={(v) => {
              const newMode = (v as LayoutMode) || null;
              onModeChange(newMode);
            }}
            type="single"
            value={mode ?? ""}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  active={mode === "preview"}
                  aria-label="Preview"
                  value="preview"
                >
                  <Eye className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("attemptHeaderActions.preview")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  active={mode === "diffs"}
                  aria-label="Diffs"
                  value="diffs"
                >
                  <FileDiff className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("attemptHeaderActions.diffs")}
              </TooltipContent>
            </Tooltip>
          </ToggleGroup>
        </TooltipProvider>
      )}
      {typeof mode !== "undefined" && onModeChange && (
        <div className="h-4 w-px bg-border" />
      )}
      <ActionsDropdown attempt={attempt} sharedTask={sharedTask} task={task} />
      <Button aria-label="Close" onClick={onClose} variant="icon">
        <X size={16} />
      </Button>
    </>
  );
};
