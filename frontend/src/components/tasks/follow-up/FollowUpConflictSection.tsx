import { useEffect, useRef, useState } from "react";
import type { RepoBranchStatus } from "shared/types";
import { ConflictBanner } from "@/components/tasks/ConflictBanner";
import { useAttemptConflicts } from "@/hooks/useAttemptConflicts";
import { useOpenInEditor } from "@/hooks/useOpenInEditor";

type Props = {
  workspaceId?: string;
  attemptBranch: string | null;
  branchStatus: RepoBranchStatus[] | undefined;
  isEditable: boolean;
  onResolve?: () => void;
  enableResolve: boolean;
  enableAbort: boolean;
  conflictResolutionInstructions: string | null;
};

export function FollowUpConflictSection({
  workspaceId,
  attemptBranch,
  branchStatus,
  onResolve,
  enableResolve,
  enableAbort,
  conflictResolutionInstructions,
}: Props) {
  const repoWithConflicts = branchStatus?.find(
    (r) => r.is_rebase_in_progress || (r.conflicted_files?.length ?? 0) > 0
  );
  const op = repoWithConflicts?.conflict_op ?? null;
  const openInEditor = useOpenInEditor(workspaceId);
  const repoId = repoWithConflicts?.repo_id;
  const { abortConflicts } = useAttemptConflicts(workspaceId, repoId);

  // write using setAborting and read through abortingRef in async handlers
  const [aborting, setAborting] = useState(false);
  const abortingRef = useRef(false);
  useEffect(() => {
    abortingRef.current = aborting;
  }, [aborting]);

  if (!repoWithConflicts) return null;

  return (
    <>
      <ConflictBanner
        attemptBranch={attemptBranch}
        baseBranch={repoWithConflicts.target_branch_name ?? ""}
        conflictedFiles={repoWithConflicts.conflicted_files || []}
        enableAbort={enableAbort && !aborting}
        enableResolve={enableResolve && !aborting}
        onAbort={async () => {
          if (!workspaceId) return;
          if (!enableAbort || abortingRef.current) return;
          try {
            setAborting(true);
            await abortConflicts();
          } catch (e) {
            console.error("Failed to abort conflicts", e);
          } finally {
            setAborting(false);
          }
        }}
        onOpenEditor={() => {
          if (!workspaceId) return;
          const first = repoWithConflicts.conflicted_files?.[0];
          openInEditor(first ? { filePath: first } : undefined);
        }}
        onResolve={onResolve}
        op={op}
      />
      {/* Conflict instructions preview (non-editable) */}
      {conflictResolutionInstructions && enableResolve && (
        <div className="mb-4 text-sm">
          <div className="mb-1 font-medium text-warning-foreground text-xs dark:text-warning">
            Conflict resolution instructions
          </div>
          <div className="whitespace-pre-wrap">
            {conflictResolutionInstructions}
          </div>
        </div>
      )}
    </>
  );
}
