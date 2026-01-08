import { type DiffFile, generateDiffFile } from "@git-diff-view/file";
import { DiffModeEnum, DiffView, SplitSide } from "@git-diff-view/react";
import {
  ArrowLeftRight,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  FilePlus2,
  Key,
  MessageSquare,
  PencilLine,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import type { Diff } from "shared/types";
import { useUserSystem } from "@/components/ConfigProvider";
import { Button } from "@/components/ui/button";
import { getHighLightLanguageFromPath } from "@/utils/extToLanguage";
import { stripLineEnding } from "@/utils/string";
import { getActualTheme } from "@/utils/theme";
import "@/styles/diff-style-overrides.css";
import type { Workspace } from "shared/types";
import { CommentWidgetLine } from "@/components/diff/CommentWidgetLine";
import { ReviewCommentRenderer } from "@/components/diff/ReviewCommentRenderer";
import { useProject } from "@/contexts/ProjectContext";
import {
  type ReviewComment,
  type ReviewDraft,
  useReview,
} from "@/contexts/ReviewProvider";
import { attemptsApi } from "@/lib/api";
import {
  useDiffViewMode,
  useIgnoreWhitespaceDiff,
  useWrapTextDiff,
} from "@/stores/useDiffViewStore";

type Props = {
  diff: Diff;
  expanded: boolean;
  onToggle: () => void;
  selectedAttempt: Workspace | null;
};

function labelAndIcon(diff: Diff) {
  const c = diff.change;
  if (c === "deleted") return { label: "Deleted", Icon: Trash2 };
  if (c === "renamed") return { label: "Renamed", Icon: ArrowLeftRight };
  if (c === "added")
    return { label: undefined as string | undefined, Icon: FilePlus2 };
  if (c === "copied") return { label: "Copied", Icon: Copy };
  if (c === "permissionChange")
    return { label: "Permission Changed", Icon: Key };
  return { label: undefined as string | undefined, Icon: PencilLine };
}

function readPlainLine(
  diffFile: DiffFile | null,
  lineNumber: number,
  side: SplitSide
) {
  if (!diffFile) return undefined;
  try {
    const rawLine =
      side === SplitSide.old
        ? diffFile.getOldPlainLine(lineNumber)
        : diffFile.getNewPlainLine(lineNumber);
    if (rawLine?.value === undefined) return undefined;
    return stripLineEnding(rawLine.value);
  } catch (error) {
    console.error("Failed to read line content for review comment", error);
    return undefined;
  }
}

export default function DiffCard({
  diff,
  expanded,
  onToggle,
  selectedAttempt,
}: Props) {
  const { config } = useUserSystem();
  const theme = getActualTheme(config?.theme);
  const { comments, drafts, setDraft } = useReview();
  const globalMode = useDiffViewMode();
  const ignoreWhitespace = useIgnoreWhitespaceDiff();
  const wrapText = useWrapTextDiff();
  const { projectId } = useProject();

  const oldName = diff.oldPath || undefined;
  const newName = diff.newPath || oldName || "unknown";
  const oldLang =
    getHighLightLanguageFromPath(oldName || newName || "") || "plaintext";
  const newLang =
    getHighLightLanguageFromPath(newName || oldName || "") || "plaintext";
  const { label, Icon } = labelAndIcon(diff);
  const isOmitted = !!diff.contentOmitted;

  // Build a diff from raw contents so the viewer can expand beyond hunks
  const oldContentSafe = diff.oldContent || "";
  const newContentSafe = diff.newContent || "";
  const isContentEqual = oldContentSafe === newContentSafe;

  const diffOptions = useMemo(
    () => (ignoreWhitespace ? { ignoreWhitespace: true as const } : undefined),
    [ignoreWhitespace]
  );

  const diffFile = useMemo(() => {
    if (isContentEqual || isOmitted) return null;
    try {
      const oldFileName = oldName || newName || "unknown";
      const newFileName = newName || oldName || "unknown";
      const file = generateDiffFile(
        oldFileName,
        oldContentSafe,
        newFileName,
        newContentSafe,
        oldLang,
        newLang,
        diffOptions
      );
      file.initRaw();
      return file;
    } catch (e) {
      console.error("Failed to build diff for view", e);
      return null;
    }
  }, [
    isContentEqual,
    isOmitted,
    oldName,
    newName,
    oldLang,
    newLang,
    oldContentSafe,
    newContentSafe,
    diffOptions,
  ]);

  const add = isOmitted
    ? (diff.additions ?? 0)
    : (diffFile?.additionLength ?? 0);
  const del = isOmitted
    ? (diff.deletions ?? 0)
    : (diffFile?.deletionLength ?? 0);

  // Review functionality
  const filePath = newName || oldName || "unknown";
  const commentsForFile = useMemo(
    () => comments.filter((c) => c.filePath === filePath),
    [comments, filePath]
  );

  // Transform comments to git-diff-view extendData format
  const extendData = useMemo(() => {
    const oldFileData: Record<string, { data: ReviewComment }> = {};
    const newFileData: Record<string, { data: ReviewComment }> = {};

    commentsForFile.forEach((comment) => {
      const lineKey = String(comment.lineNumber);
      if (comment.side === SplitSide.old) {
        oldFileData[lineKey] = { data: comment };
      } else {
        newFileData[lineKey] = { data: comment };
      }
    });

    return {
      oldFile: oldFileData,
      newFile: newFileData,
    };
  }, [commentsForFile]);

  const handleAddWidgetClick = (lineNumber: number, side: SplitSide) => {
    const widgetKey = `${filePath}-${side}-${lineNumber}`;
    const codeLine = readPlainLine(diffFile, lineNumber, side);
    const draft: ReviewDraft = {
      filePath,
      side,
      lineNumber,
      text: "",
      ...(codeLine !== undefined ? { codeLine } : {}),
    };
    setDraft(widgetKey, draft);
  };

  const renderWidgetLine = (props: {
    side: SplitSide;
    lineNumber: number;
    onClose: () => void;
  }) => {
    const widgetKey = `${filePath}-${props.side}-${props.lineNumber}`;
    const draft = drafts[widgetKey];
    if (!draft) return null;

    return (
      <CommentWidgetLine
        draft={draft}
        onCancel={props.onClose}
        onSave={props.onClose}
        projectId={projectId}
        widgetKey={widgetKey}
      />
    );
  };

  const renderExtendLine = (lineData: { data: ReviewComment }) => {
    return (
      <ReviewCommentRenderer comment={lineData.data} projectId={projectId} />
    );
  };

  // Title row
  const title = (
    <p
      className="flex-1 overflow-x-auto font-mono text-sm"
      style={{ color: "hsl(var(--muted-foreground) / 0.7)" }}
    >
      <Icon aria-hidden className="mr-2 inline h-3 w-3" />
      {label && <span className="mr-2">{label}</span>}
      {diff.change === "renamed" && oldName ? (
        <span className="inline-flex items-center gap-2">
          <span>{oldName}</span>
          <span aria-hidden>→</span>
          <span>{newName}</span>
        </span>
      ) : (
        <span>{newName}</span>
      )}
      <span className="ml-3" style={{ color: "hsl(var(--console-success))" }}>
        +{add}
      </span>
      <span className="ml-2" style={{ color: "hsl(var(--console-error))" }}>
        -{del}
      </span>
      {commentsForFile.length > 0 && (
        <span className="ml-3 inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-primary text-xs">
          <MessageSquare className="h-3 w-3" />
          {commentsForFile.length}
        </span>
      )}
    </p>
  );

  const handleOpenInIDE = async () => {
    if (!selectedAttempt?.id) return;
    try {
      const openPath = newName || oldName;
      const response = await attemptsApi.openEditor(selectedAttempt.id, {
        editor_type: null,
        file_path: openPath ?? null,
      });

      // If a URL is returned, open it in a new window/tab
      if (response.url) {
        window.open(response.url, "_blank");
      }
    } catch (err) {
      console.error("Failed to open file in IDE:", err);
    }
  };

  const expandable = true;

  return (
    <div className="my-4 border">
      <div className="sticky top-0 z-[5] flex items-center border-b bg-background px-4 py-2">
        {expandable && (
          <Button
            aria-expanded={expanded}
            className="mr-2 h-6 w-6 p-0"
            onClick={onToggle}
            size="sm"
            title={expanded ? "Collapse" : "Expand"}
            variant="ghost"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        )}
        {title}
        <Button
          className="ml-2 h-6 w-6 p-0"
          disabled={diff.change === "deleted"}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenInIDE();
          }}
          size="sm"
          title="Open in IDE"
          variant="ghost"
        >
          <ExternalLink aria-hidden className="h-3 w-3" />
        </Button>
      </div>

      {expanded && diffFile && (
        <div>
          <DiffView
            diffFile={diffFile}
            diffViewAddWidget
            diffViewFontSize={12}
            diffViewHighlight
            diffViewMode={
              globalMode === "split" ? DiffModeEnum.Split : DiffModeEnum.Unified
            }
            diffViewTheme={theme}
            diffViewWrap={wrapText}
            extendData={extendData}
            onAddWidgetClick={handleAddWidgetClick}
            renderExtendLine={renderExtendLine}
            renderWidgetLine={renderWidgetLine}
          />
        </div>
      )}
      {expanded && !diffFile && (
        <div
          className="px-4 pb-4 font-mono text-xs"
          style={{ color: "hsl(var(--muted-foreground) / 0.9)" }}
        >
          {isOmitted
            ? "Content omitted due to file size. Open in editor to view."
            : isContentEqual
              ? diff.change === "renamed"
                ? "File renamed with no content changes."
                : diff.change === "permissionChange"
                  ? "File permission changed."
                  : "No content changes to display."
              : "Failed to render diff for this file."}
        </div>
      )}
    </div>
  );
}
