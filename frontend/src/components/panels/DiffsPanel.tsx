import { ChevronsDown, ChevronsUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Diff, DiffChangeKind, Workspace } from "shared/types";
import DiffCard from "@/components/DiffCard";
import DiffViewSwitch from "@/components/DiffViewSwitch";
import GitOperations, {
  type GitOperationsInputs,
} from "@/components/tasks/Toolbar/GitOperations.tsx";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { NewCardHeader } from "@/components/ui/new-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDiffStream } from "@/hooks/useDiffStream";
import { useDiffSummary } from "@/hooks/useDiffSummary";

interface DiffsPanelProps {
  selectedAttempt: Workspace | null;
  gitOps?: GitOperationsInputs;
}

type DiffCollapseDefaults = Record<DiffChangeKind, boolean>;

const DEFAULT_DIFF_COLLAPSE_DEFAULTS: DiffCollapseDefaults = {
  added: false,
  deleted: true,
  modified: false,
  renamed: true,
  copied: true,
  permissionChange: true,
};

const DEFAULT_COLLAPSE_MAX_LINES = 200;

const exceedsMaxLineCount = (d: Diff, maxLines: number): boolean => {
  if (d.additions != null || d.deletions != null)
    return (d.additions ?? 0) + (d.deletions ?? 0) > maxLines;

  return true;
};

const getDiffId = ({ diff, index }: { diff: Diff; index: number }) =>
  `${diff.newPath || diff.oldPath || index}`;

export function DiffsPanel({ selectedAttempt, gitOps }: DiffsPanelProps) {
  const { t } = useTranslation("tasks");
  const [loadingState, setLoadingState] = useState<
    "loading" | "loaded" | "timed-out"
  >("loading");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const { diffs, error } = useDiffStream(selectedAttempt?.id ?? null, true);
  const { fileCount, added, deleted } = useDiffSummary(
    selectedAttempt?.id ?? null
  );

  // If no diffs arrive within 3 seconds, stop showing the spinner
  useEffect(() => {
    if (loadingState !== "loading") return;
    const timer = setTimeout(() => setLoadingState("timed-out"), 3000);
    return () => clearTimeout(timer);
  }, [loadingState]);

  if (diffs.length > 0 && loadingState === "loading") {
    setLoadingState("loaded");
  }

  if (diffs.length > 0) {
    const newDiffs = diffs
      .map((d, index) => ({ diff: d, index }))
      .filter((d) => {
        const id = getDiffId(d);
        return !processedIds.has(id);
      });

    if (newDiffs.length > 0) {
      const newIds = newDiffs.map(getDiffId);
      const toCollapse = newDiffs
        .filter(
          ({ diff }) =>
            DEFAULT_DIFF_COLLAPSE_DEFAULTS[diff.change] ||
            exceedsMaxLineCount(diff, DEFAULT_COLLAPSE_MAX_LINES)
        )
        .map(getDiffId);

      setProcessedIds((prev) => new Set([...prev, ...newIds]));
      if (toCollapse.length > 0) {
        setCollapsedIds((prev) => new Set([...prev, ...toCollapse]));
      }
    }
  }

  const loading = loadingState === "loading";

  const ids = useMemo(() => {
    return diffs.map((d, i) => getDiffId({ diff: d, index: i }));
  }, [diffs]);

  const toggle = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allCollapsed = collapsedIds.size === diffs.length;
  const handleCollapseAll = useCallback(() => {
    setCollapsedIds(allCollapsed ? new Set() : new Set(ids));
  }, [allCollapsed, ids]);

  if (error) {
    return (
      <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="text-red-800 text-sm">
          {t("diff.errorLoadingDiff", { error })}
        </div>
      </div>
    );
  }

  return (
    <DiffsPanelContent
      added={added}
      allCollapsed={allCollapsed}
      collapsedIds={collapsedIds}
      deleted={deleted}
      diffs={diffs}
      fileCount={fileCount}
      gitOps={gitOps}
      handleCollapseAll={handleCollapseAll}
      loading={loading}
      selectedAttempt={selectedAttempt}
      t={t}
      toggle={toggle}
    />
  );
}

interface DiffsPanelContentProps {
  diffs: Diff[];
  fileCount: number;
  added: number;
  deleted: number;
  collapsedIds: Set<string>;
  allCollapsed: boolean;
  handleCollapseAll: () => void;
  toggle: (id: string) => void;
  selectedAttempt: Workspace | null;
  gitOps?: GitOperationsInputs;
  loading: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function DiffsPanelContent({
  diffs,
  fileCount,
  added,
  deleted,
  collapsedIds,
  allCollapsed,
  handleCollapseAll,
  toggle,
  selectedAttempt,
  gitOps,
  loading,
  t,
}: DiffsPanelContentProps) {
  return (
    <div className="relative flex h-full flex-col">
      {diffs.length > 0 && (
        <NewCardHeader
          actions={
            <>
              <DiffViewSwitch />
              <div className="h-4 w-px bg-border" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={
                        allCollapsed
                          ? t("diff.expandAll")
                          : t("diff.collapseAll")
                      }
                      aria-pressed={allCollapsed}
                      onClick={handleCollapseAll}
                      variant="icon"
                    >
                      {allCollapsed ? (
                        <ChevronsDown className="h-4 w-4" />
                      ) : (
                        <ChevronsUp className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {allCollapsed ? t("diff.expandAll") : t("diff.collapseAll")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          }
          className="sticky top-0 z-10"
        >
          <div className="flex items-center">
            <span
              aria-live="polite"
              className="whitespace-nowrap text-muted-foreground text-sm"
            >
              {t("diff.filesChanged", { count: fileCount })}{" "}
              <span className="text-green-600 dark:text-green-500">
                +{added}
              </span>{" "}
              <span className="text-red-600 dark:text-red-500">-{deleted}</span>
            </span>
          </div>
        </NewCardHeader>
      )}
      {gitOps && selectedAttempt && (
        <div className="px-3">
          <GitOperations selectedAttempt={selectedAttempt} {...gitOps} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader />
          </div>
        ) : diffs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            {t("diff.noChanges")}
          </div>
        ) : (
          diffs.map((diff, idx) => {
            const id = diff.newPath || diff.oldPath || String(idx);
            return (
              <DiffCard
                diff={diff}
                expanded={!collapsedIds.has(id)}
                key={id}
                onToggle={() => toggle(id)}
                selectedAttempt={selectedAttempt}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
