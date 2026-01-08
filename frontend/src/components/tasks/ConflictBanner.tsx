import { AlertCircle } from "lucide-react";
import type { ConflictOp } from "shared/types";
import { Button } from "@/components/ui/button";
import { displayConflictOpLabel } from "@/lib/conflicts";

export type Props = Readonly<{
  attemptBranch: string | null;
  baseBranch?: string;
  conflictedFiles: readonly string[];
  onOpenEditor: () => void;
  onAbort: () => void;
  op?: ConflictOp | null;
  onResolve?: () => void;
  enableResolve: boolean;
  enableAbort: boolean;
}>;

const MAX_VISIBLE_FILES = 8;

function getOperationTitle(op?: ConflictOp | null): {
  full: string;
  lower: string;
} {
  const title = displayConflictOpLabel(op);
  return { full: title, lower: title.toLowerCase() };
}

function getVisibleFiles(
  files: readonly string[],
  max = MAX_VISIBLE_FILES
): { visible: string[]; total: number; hasMore: boolean } {
  const visible = files.slice(0, max);
  return {
    visible,
    total: files.length,
    hasMore: files.length > visible.length,
  };
}

export function ConflictBanner({
  attemptBranch,
  baseBranch,
  conflictedFiles,
  onOpenEditor,
  onAbort,
  op,
  onResolve,
  enableResolve,
  enableAbort,
}: Props) {
  const { full: opTitle, lower: opTitleLower } = getOperationTitle(op);
  const {
    visible: visibleFiles,
    total,
    hasMore,
  } = getVisibleFiles(conflictedFiles);

  const heading = attemptBranch
    ? `${opTitle} in progress: '${attemptBranch}' → '${baseBranch}'.`
    : "A Git operation with merge conflicts is in progress.";

  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-warning-foreground dark:text-warning"
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          aria-hidden
          className="mt-0.5 h-4 w-4 text-warning dark:text-warning/90"
        />
        <div className="text-sm leading-relaxed">
          <span>{heading}</span>{" "}
          <span>
            Follow-ups are allowed; some actions may be temporarily unavailable
            until you resolve the conflicts or abort the {opTitleLower}.
          </span>
          {visibleFiles.length > 0 && (
            <div className="mt-1 text-warning-foreground/90 text-xs dark:text-warning/80">
              <div className="font-medium">
                Conflicted files ({visibleFiles.length}
                {hasMore ? ` of ${total}` : ""}):
              </div>
              <div className="mt-1 grid grid-cols-1 gap-0.5">
                {visibleFiles.map((f) => (
                  <div className="truncate" key={f}>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {onResolve && (
          <Button
            className="bg-warning text-warning-foreground hover:bg-warning/90"
            disabled={!enableResolve}
            onClick={onResolve}
            size="sm"
          >
            Resolve conflicts
          </Button>
        )}
        <Button
          className="border-warning/40 text-warning-foreground hover:bg-warning/10 dark:text-warning/90"
          onClick={onOpenEditor}
          size="sm"
          variant="outline"
        >
          Open in Editor
        </Button>

        <Button
          aria-disabled={!enableAbort}
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={!enableAbort}
          onClick={onAbort}
          size="sm"
          variant="outline"
        >
          Abort {opTitle}
        </Button>
      </div>
    </div>
  );
}
