import { Code, ExternalLink, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface GitHubCommentCardProps {
  author: string;
  body: string;
  createdAt: string;
  url: string;
  // Optional review-specific fields
  commentType?: "general" | "review";
  path?: string;
  line?: number | null;
  diffHunk?: string;
  /** Display variant: 'compact' for inline chip, 'full' for inline card, 'list' for block card */
  variant: "compact" | "full" | "list";
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  className?: string;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function truncateBody(body: string, maxLength: number): string {
  if (body.length <= maxLength) return body;
  return body.slice(0, maxLength - 3) + "...";
}

/**
 * Renders a diff hunk with syntax highlighting for added/removed lines
 */
function DiffHunk({ diffHunk }: { diffHunk: string }) {
  const lines = diffHunk.split("\n");

  return (
    <pre className="mt-2 max-h-32 overflow-x-auto overflow-y-auto rounded bg-secondary p-2 font-mono text-xs">
      {lines.map((line, i) => {
        let lineClass = "block";
        if (line.startsWith("+") && !line.startsWith("+++")) {
          lineClass =
            "block bg-green-500/20 text-green-700 dark:text-green-400";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          lineClass = "block bg-red-500/20 text-red-700 dark:text-red-400";
        } else if (line.startsWith("@@")) {
          lineClass = "block text-muted-foreground";
        }
        return (
          <code className={lineClass} key={i}>
            {line}
          </code>
        );
      })}
    </pre>
  );
}

/**
 * Compact variant - inline chip for WYSIWYG editor
 */
function CompactCard({
  author,
  body,
  commentType,
  path,
  onClick,
  onDoubleClick,
  className,
}: GitHubCommentCardProps) {
  const { t } = useTranslation("tasks");
  const isReview = commentType === "review";
  const Icon = isReview ? Code : MessageSquare;
  const displayText = isReview && path ? `${path}: ${body}` : body;

  return (
    <span
      className={cn(
        "inline-flex max-w-[300px] cursor-pointer items-center gap-1.5 rounded border border-border bg-muted py-0.5 align-middle hover:border-muted-foreground",
        className
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      role="button"
      tabIndex={0}
      title={`@${author}: ${body}\n\n${t("githubComments.card.tooltip")}`}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="flex-shrink-0 font-medium text-xs">@{author}</span>
      <span className="truncate text-muted-foreground text-xs">
        {truncateBody(displayText, 50)}
      </span>
    </span>
  );
}

/**
 * Full variant - card for dialog selection
 */
function FullCard({
  author,
  body,
  createdAt,
  url,
  commentType,
  path,
  line,
  diffHunk,
  onClick,
  variant,
  className,
}: GitHubCommentCardProps) {
  const { t } = useTranslation("tasks");
  const isReview = commentType === "review";
  const Icon = isReview ? Code : MessageSquare;

  return (
    <div
      className={cn(
        "cursor-pointer overflow-hidden rounded-md border border-border bg-muted/50 p-3 transition-colors hover:border-muted-foreground",
        variant === "full" && "inline-block max-w-md align-bottom",
        className
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="font-medium text-sm">@{author}</span>
          {isReview && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground text-xs">
              {t("githubComments.card.review")}
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1 text-muted-foreground text-xs">
          <span>{formatDate(createdAt)}</span>
          {url && (
            <button
              aria-label="Open in GitHub"
              className="transition-colors hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              type="button"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* File path for review comments */}
      {isReview && path && (
        <div className="mb-1 font-mono text-primary/70 text-xs">
          {path}
          {line ? `:${line}` : ""}
        </div>
      )}

      {/* Diff hunk for review comments */}
      {isReview && diffHunk && <DiffHunk diffHunk={diffHunk} />}

      {/* Comment body */}
      <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground text-sm">
        {body}
      </p>
    </div>
  );
}

/**
 * GitHubCommentCard - Shared presentational component for GitHub PR comments
 *
 * @param variant - 'compact' for inline chip, 'full' for inline card, 'list' for block card
 */
export function GitHubCommentCard(props: GitHubCommentCardProps) {
  if (props.variant === "compact") {
    return <CompactCard {...props} />;
  }
  // Both 'full' and 'list' use FullCard, just with different styling
  return <FullCard {...props} />;
}
