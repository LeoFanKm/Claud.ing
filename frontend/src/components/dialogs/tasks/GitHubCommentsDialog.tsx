import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { AlertCircle, Loader2, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UnifiedPrComment } from "shared/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitHubCommentCard } from "@/components/ui/github-comment-card";
import { usePrComments } from "@/hooks/usePrComments";
import { defineModal } from "@/lib/modals";

export interface GitHubCommentsDialogProps {
  attemptId: string;
  repoId: string;
}

export interface GitHubCommentsDialogResult {
  comments: UnifiedPrComment[];
}

function getCommentId(comment: UnifiedPrComment): string {
  return comment.comment_type === "general"
    ? comment.id
    : comment.id.toString();
}

const GitHubCommentsDialogImpl = NiceModal.create<GitHubCommentsDialogProps>(
  ({ attemptId, repoId }) => {
    const { t } = useTranslation(["tasks", "common"]);
    const modal = useModal();
    const { data, isLoading, isError, error } = usePrComments(
      attemptId,
      repoId
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const comments = data?.comments ?? [];

    // Reset selection when dialog opens
    useEffect(() => {
      if (modal.visible) {
        setSelectedIds(new Set());
      }
    }, [modal.visible]);

    const toggleSelection = (id: string) => {
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    };

    const selectAll = () => {
      setSelectedIds(new Set(comments.map((c) => getCommentId(c))));
    };

    const deselectAll = () => {
      setSelectedIds(new Set());
    };

    const isAllSelected =
      comments.length > 0 && selectedIds.size === comments.length;

    const handleConfirm = () => {
      const selected = comments.filter((c) => selectedIds.has(getCommentId(c)));
      modal.resolve({ comments: selected });
      modal.hide();
    };

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        modal.resolve({ comments: [] });
        modal.hide();
      }
    };

    // Check for specific error types from the API
    const errorMessage = isError ? getErrorMessage(error) : null;

    return (
      <Dialog
        className="max-w-2xl overflow-hidden p-0"
        onOpenChange={handleOpenChange}
        open={modal.visible}
      >
        <DialogContent
          className="p-0"
          onKeyDownCapture={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              modal.resolve({ comments: [] });
              modal.hide();
            }
          }}
        >
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {t("tasks:githubComments.dialog.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex max-h-[70vh] min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {errorMessage ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  {t("tasks:githubComments.dialog.noComments")}
                </p>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      {t("tasks:githubComments.dialog.selectedCount", {
                        selected: selectedIds.size,
                        total: comments.length,
                      })}
                    </span>
                    <Button
                      onClick={isAllSelected ? deselectAll : selectAll}
                      size="sm"
                      variant="ghost"
                    >
                      {isAllSelected
                        ? t("tasks:githubComments.dialog.deselectAll")
                        : t("tasks:githubComments.dialog.selectAll")}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {comments.map((comment) => {
                      const id = getCommentId(comment);
                      return (
                        <div
                          className="flex min-w-0 items-start gap-3"
                          key={id}
                        >
                          <Checkbox
                            checked={selectedIds.has(id)}
                            className="mt-3"
                            onCheckedChange={() => toggleSelection(id)}
                          />
                          <GitHubCommentCard
                            author={comment.author}
                            body={comment.body}
                            className="min-w-0 flex-1"
                            commentType={comment.comment_type}
                            createdAt={comment.created_at}
                            diffHunk={
                              comment.comment_type === "review"
                                ? comment.diff_hunk
                                : undefined
                            }
                            line={
                              comment.comment_type === "review" &&
                              comment.line != null
                                ? Number(comment.line)
                                : undefined
                            }
                            onClick={() => toggleSelection(id)}
                            path={
                              comment.comment_type === "review"
                                ? comment.path
                                : undefined
                            }
                            url={comment.url}
                            variant="list"
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {!(errorMessage || isLoading) && comments.length > 0 && (
            <DialogFooter className="border-t px-4 py-3">
              <Button onClick={() => handleOpenChange(false)} variant="outline">
                {t("common:buttons.cancel")}
              </Button>
              <Button disabled={selectedIds.size === 0} onClick={handleConfirm}>
                {t("tasks:githubComments.dialog.add")}
                {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

function getErrorMessage(error: unknown): string {
  // Check if it's an API error with error_data
  if (error && typeof error === "object" && "error_data" in error) {
    const errorData = (error as { error_data?: { type?: string } }).error_data;
    if (errorData?.type === "no_pr_attached") {
      return "No PR is attached to this task attempt. Create a PR first to see comments.";
    }
    if (errorData?.type === "github_cli_not_installed") {
      return "GitHub CLI is not installed. Please install it to fetch PR comments.";
    }
    if (errorData?.type === "github_cli_not_logged_in") {
      return 'GitHub CLI is not logged in. Please run "gh auth login" to authenticate.';
    }
  }
  return "Failed to load PR comments. Please try again.";
}

export const GitHubCommentsDialog = defineModal<
  GitHubCommentsDialogProps,
  GitHubCommentsDialogResult
>(GitHubCommentsDialogImpl);
