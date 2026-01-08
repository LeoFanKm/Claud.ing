import {
  AlertCircle,
  Clock,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  StopCircle,
  Terminal,
  X,
} from "lucide-react";
import { lazy, Suspense } from "react";

// Lazy load heavy Lexical editor for code splitting
const WYSIWYGEditor = lazy(() => import("@/components/ui/wysiwyg"));

//
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeysContext } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import type {
  DraftFollowUpData,
  ExecutorAction,
  ExecutorProfileId,
  Session,
} from "shared/types";
import { ScratchType, type TaskWithAttemptStatus } from "shared/types";
import { useUserSystem } from "@/components/ConfigProvider";
import { GitHubCommentsDialog } from "@/components/dialogs/tasks/GitHubCommentsDialog";
import { ClickedElementsBanner } from "@/components/tasks/ClickedElementsBanner";
import { FollowUpConflictSection } from "@/components/tasks/follow-up/FollowUpConflictSection";
//
import { VariantSelector } from "@/components/tasks/VariantSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useClickedElements } from "@/contexts/ClickedElementsProvider";
import { useEntries } from "@/contexts/EntriesContext";
import { useProject } from "@/contexts/ProjectContext";
import { useRetryUi } from "@/contexts/RetryUiContext";
//
import { useReview } from "@/contexts/ReviewProvider";
import { useBranchStatus } from "@/hooks";
import { useAttemptBranch } from "@/hooks/useAttemptBranch";
import { useAttemptExecution } from "@/hooks/useAttemptExecution";
import { useAttemptRepo } from "@/hooks/useAttemptRepo";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useFollowUpSend } from "@/hooks/useFollowUpSend";
import { useQueueStatus } from "@/hooks/useQueueStatus";
import { useScratch } from "@/hooks/useScratch";
import { useVariant } from "@/hooks/useVariant";
import { Scope, useKeySubmitFollowUp } from "@/keyboard";
import { attemptsApi, imagesApi } from "@/lib/api";
import { buildResolveConflictsInstructions } from "@/lib/conflicts";
import { cn } from "@/lib/utils";

// Inline type to avoid importing from wysiwyg module (breaks code splitting)
interface NormalizedComment {
  id: string;
  comment_type: "general" | "review";
  author: string;
  body: string;
  created_at: string;
  url: string;
  path?: string;
  line?: number | null;
  diff_hunk?: string;
}

interface TaskFollowUpSectionProps {
  task: TaskWithAttemptStatus;
  session?: Session;
}

export function TaskFollowUpSection({
  task,
  session,
}: TaskFollowUpSectionProps) {
  const { t } = useTranslation("tasks");
  const { projectId } = useProject();

  // Derive IDs from session
  const workspaceId = session?.workspace_id;
  const sessionId = session?.id;

  const { isAttemptRunning, stopExecution, isStopping, processes } =
    useAttemptExecution(workspaceId, task.id);

  const { data: branchStatus, refetch: refetchBranchStatus } =
    useBranchStatus(workspaceId);
  const { repos, selectedRepoId } = useAttemptRepo(workspaceId);

  const getSelectedRepoId = useCallback(() => {
    return selectedRepoId ?? repos[0]?.id;
  }, [selectedRepoId, repos]);

  const repoWithConflicts = useMemo(
    () =>
      branchStatus?.find(
        (r) => r.is_rebase_in_progress || (r.conflicted_files?.length ?? 0) > 0
      ),
    [branchStatus]
  );
  const { branch: attemptBranch, refetch: refetchAttemptBranch } =
    useAttemptBranch(workspaceId);
  const { profiles } = useUserSystem();
  const { comments, generateReviewMarkdown, clearComments } = useReview();
  const {
    generateMarkdown: generateClickedMarkdown,
    clearElements: clearClickedElements,
  } = useClickedElements();
  const { enableScope, disableScope } = useHotkeysContext();

  const reviewMarkdown = useMemo(
    () => generateReviewMarkdown(),
    [generateReviewMarkdown]
  );

  const clickedMarkdown = useMemo(
    () => generateClickedMarkdown(),
    [generateClickedMarkdown]
  );

  // Non-editable conflict resolution instructions (derived, like review comments)
  const conflictResolutionInstructions = useMemo(() => {
    if (!repoWithConflicts?.conflicted_files?.length) return null;
    return buildResolveConflictsInstructions(
      attemptBranch,
      repoWithConflicts.target_branch_name,
      repoWithConflicts.conflicted_files,
      repoWithConflicts.conflict_op ?? null,
      repoWithConflicts.repo_name
    );
  }, [attemptBranch, repoWithConflicts]);

  // Editor state (persisted via scratch)
  const {
    scratch,
    updateScratch,
    isLoading: isScratchLoading,
  } = useScratch(ScratchType.DRAFT_FOLLOW_UP, sessionId ?? "");

  // Derive the message and variant from scratch
  const scratchData: DraftFollowUpData | undefined =
    scratch?.payload?.type === "DRAFT_FOLLOW_UP"
      ? scratch.payload.data
      : undefined;

  // Track whether the follow-up textarea is focused
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);

  // Local message state for immediate UI feedback (before debounced save)
  const [localMessage, setLocalMessage] = useState("");

  // Variant selection - derive default from latest process
  const latestProfileId = useMemo<ExecutorProfileId | null>(() => {
    if (!processes?.length) return null;

    const extractProfile = (
      action: ExecutorAction | null
    ): ExecutorProfileId | null => {
      let curr: ExecutorAction | null = action;
      while (curr) {
        const typ = curr.typ;
        switch (typ.type) {
          case "CodingAgentInitialRequest":
          case "CodingAgentFollowUpRequest":
            return typ.executor_profile_id;
          case "ScriptRequest":
            curr = curr.next_action;
            continue;
        }
      }
      return null;
    };
    return (
      processes
        .slice()
        .reverse()
        .map((p) => extractProfile(p.executor_action ?? null))
        .find((pid) => pid !== null) ?? null
    );
  }, [processes]);

  const processVariant = latestProfileId?.variant ?? null;

  const currentProfile = useMemo(() => {
    if (!latestProfileId) return null;
    return profiles?.[latestProfileId.executor] ?? null;
  }, [latestProfileId, profiles]);

  // Variant selection with priority: user selection > scratch > process
  const { selectedVariant, setSelectedVariant: setVariantFromHook } =
    useVariant({
      processVariant,
      scratchVariant: scratchData?.variant,
    });

  // Ref to track current variant for use in message save callback
  const variantRef = useRef<string | null>(selectedVariant);
  useEffect(() => {
    variantRef.current = selectedVariant;
  }, [selectedVariant]);

  // Refs to stabilize callbacks - avoid re-creating callbacks when these values change
  const scratchRef = useRef(scratch);
  useEffect(() => {
    scratchRef.current = scratch;
  }, [scratch]);

  // Save scratch helper (used for both message and variant changes)
  // Uses scratchRef to avoid callback invalidation when scratch updates
  const saveToScratch = useCallback(
    async (message: string, variant: string | null) => {
      if (!workspaceId) return;
      // Don't create empty scratch entries - only save if there's actual content,
      // a variant is selected, or scratch already exists (to allow clearing a draft)
      if (!(message.trim() || variant || scratchRef.current)) return;
      try {
        await updateScratch({
          payload: {
            type: "DRAFT_FOLLOW_UP",
            data: { message, variant },
          },
        });
      } catch (e) {
        console.error("Failed to save follow-up draft", e);
      }
    },
    [workspaceId, updateScratch]
  );

  // Wrapper to update variant and save to scratch immediately
  const setSelectedVariant = useCallback(
    (variant: string | null) => {
      setVariantFromHook(variant);
      // Save immediately when user changes variant
      saveToScratch(localMessage, variant);
    },
    [setVariantFromHook, saveToScratch, localMessage]
  );

  // Debounced save for message changes (uses current variant from ref)
  const { debounced: setFollowUpMessage, cancel: cancelDebouncedSave } =
    useDebouncedCallback(
      useCallback(
        (value: string) => saveToScratch(value, variantRef.current),
        [saveToScratch]
      ),
      500
    );

  // Sync local message from scratch when it loads (but not while user is typing)
  useEffect(() => {
    if (isScratchLoading) return;
    if (isTextareaFocused) return; // Don't overwrite while user is typing
    setLocalMessage(scratchData?.message ?? "");
  }, [isScratchLoading, scratchData?.message, isTextareaFocused]);

  // During retry, follow-up box is greyed/disabled (not hidden)
  // Use RetryUi context so optimistic retry immediately disables this box
  const { activeRetryProcessId } = useRetryUi();
  const isRetryActive = !!activeRetryProcessId;

  // Queue status for queuing follow-up messages while agent is running
  const {
    isQueued,
    queuedMessage,
    isLoading: isQueueLoading,
    queueMessage,
    cancelQueue,
    refresh: refreshQueueStatus,
  } = useQueueStatus(sessionId);

  // Track previous process count to detect new processes
  const prevProcessCountRef = useRef(processes.length);

  // Refresh queue status when execution stops OR when a new process starts
  useEffect(() => {
    const prevCount = prevProcessCountRef.current;
    prevProcessCountRef.current = processes.length;

    if (!workspaceId) return;

    // Refresh when execution stops
    if (!isAttemptRunning) {
      refreshQueueStatus();
      return;
    }

    // Refresh when a new process starts (could be queued message consumption or follow-up)
    if (processes.length > prevCount) {
      refreshQueueStatus();
      // Re-sync local message from current scratch state
      // If scratch was deleted, scratchData will be undefined, so localMessage becomes ''
      setLocalMessage(scratchData?.message ?? "");
    }
  }, [
    isAttemptRunning,
    workspaceId,
    processes.length,
    refreshQueueStatus,
    scratchData?.message,
  ]);

  // When queued, display the queued message content so user can edit it
  const displayMessage =
    isQueued && queuedMessage ? queuedMessage.data.message : localMessage;

  // Check if there's a pending approval - users shouldn't be able to type during approvals
  const { entries } = useEntries();
  const hasPendingApproval = useMemo(() => {
    return entries.some((entry) => {
      if (entry.type !== "NORMALIZED_ENTRY") return false;
      const entryType = entry.content.entry_type;
      return (
        entryType.type === "tool_use" &&
        entryType.status.status === "pending_approval"
      );
    });
  }, [entries]);

  // Send follow-up action
  const { isSendingFollowUp, followUpError, setFollowUpError, onSendFollowUp } =
    useFollowUpSend({
      sessionId,
      message: localMessage,
      conflictMarkdown: conflictResolutionInstructions,
      reviewMarkdown,
      clickedMarkdown,
      selectedVariant,
      clearComments,
      clearClickedElements,
      onAfterSendCleanup: () => {
        cancelDebouncedSave(); // Cancel any pending debounced save to avoid race condition
        setLocalMessage(""); // Clear local state immediately
        // Scratch deletion is handled by the backend when the queued message is consumed
      },
    });

  // Separate logic for when textarea should be disabled vs when send button should be disabled
  const canTypeFollowUp = useMemo(() => {
    if (!workspaceId || processes.length === 0 || isSendingFollowUp) {
      return false;
    }

    if (isRetryActive) return false; // disable typing while retry editor is active
    if (hasPendingApproval) return false; // disable typing during approval
    // Note: isQueued no longer blocks typing - editing auto-cancels the queue
    return true;
  }, [
    workspaceId,
    processes.length,
    isSendingFollowUp,
    isRetryActive,
    hasPendingApproval,
  ]);

  const canSendFollowUp = useMemo(() => {
    if (!canTypeFollowUp) {
      return false;
    }

    // Allow sending if conflict instructions, review comments, clicked elements, or message is present
    return Boolean(
      conflictResolutionInstructions ||
        reviewMarkdown ||
        clickedMarkdown ||
        localMessage.trim()
    );
  }, [
    canTypeFollowUp,
    conflictResolutionInstructions,
    reviewMarkdown,
    clickedMarkdown,
    localMessage,
  ]);
  const isEditable = !(isRetryActive || hasPendingApproval);

  const hasAnyScript = true;

  const handleRunSetupScript = useCallback(async () => {
    if (!workspaceId || isAttemptRunning) return;
    try {
      await attemptsApi.runSetupScript(workspaceId);
    } catch (error) {
      console.error("Failed to run setup script:", error);
    }
  }, [workspaceId, isAttemptRunning]);

  const handleRunCleanupScript = useCallback(async () => {
    if (!workspaceId || isAttemptRunning) return;
    try {
      await attemptsApi.runCleanupScript(workspaceId);
    } catch (error) {
      console.error("Failed to run cleanup script:", error);
    }
  }, [workspaceId, isAttemptRunning]);

  // Handler to queue the current message for execution after agent finishes
  const handleQueueMessage = useCallback(async () => {
    if (
      !(
        localMessage.trim() ||
        conflictResolutionInstructions ||
        reviewMarkdown ||
        clickedMarkdown
      )
    ) {
      return;
    }

    // Cancel any pending debounced save and save immediately before queueing
    // This prevents the race condition where the debounce fires after queueing
    cancelDebouncedSave();
    await saveToScratch(localMessage, selectedVariant);

    // Combine all the content that would be sent (same as follow-up send)
    const parts = [
      conflictResolutionInstructions,
      clickedMarkdown,
      reviewMarkdown,
      localMessage,
    ].filter(Boolean);
    const combinedMessage = parts.join("\n\n");
    await queueMessage(combinedMessage, selectedVariant);
  }, [
    localMessage,
    conflictResolutionInstructions,
    reviewMarkdown,
    clickedMarkdown,
    selectedVariant,
    queueMessage,
    cancelDebouncedSave,
    saveToScratch,
  ]);

  // Keyboard shortcut handler - send follow-up or queue depending on state
  const handleSubmitShortcut = useCallback(
    (e?: KeyboardEvent) => {
      e?.preventDefault();
      if (isAttemptRunning) {
        // When running, CMD+Enter queues the message (if not already queued)
        if (!isQueued) {
          handleQueueMessage();
        }
      } else {
        onSendFollowUp();
      }
    },
    [isAttemptRunning, isQueued, handleQueueMessage, onSendFollowUp]
  );

  // Ref to access setFollowUpMessage without adding it as a dependency
  const setFollowUpMessageRef = useRef(setFollowUpMessage);
  useEffect(() => {
    setFollowUpMessageRef.current = setFollowUpMessage;
  }, [setFollowUpMessage]);

  // Ref for followUpError to use in stable onChange handler
  const followUpErrorRef = useRef(followUpError);
  useEffect(() => {
    followUpErrorRef.current = followUpError;
  }, [followUpError]);

  // Refs for queue state to use in stable onChange handler
  const isQueuedRef = useRef(isQueued);
  useEffect(() => {
    isQueuedRef.current = isQueued;
  }, [isQueued]);

  const cancelQueueRef = useRef(cancelQueue);
  useEffect(() => {
    cancelQueueRef.current = cancelQueue;
  }, [cancelQueue]);

  const queuedMessageRef = useRef(queuedMessage);
  useEffect(() => {
    queuedMessageRef.current = queuedMessage;
  }, [queuedMessage]);

  // Handle image paste - upload to container and insert markdown
  const handlePasteFiles = useCallback(
    async (files: File[]) => {
      if (!workspaceId) return;

      for (const file of files) {
        try {
          const response = await imagesApi.uploadForAttempt(workspaceId, file);
          // Append markdown image to current message
          const imageMarkdown = `![${response.original_name}](${response.file_path})`;

          // If queued, cancel queue and use queued message as base (same as editor change behavior)
          if (isQueuedRef.current && queuedMessageRef.current) {
            cancelQueueRef.current();
            const base = queuedMessageRef.current.data.message;
            const newMessage = base
              ? `${base}\n\n${imageMarkdown}`
              : imageMarkdown;
            setLocalMessage(newMessage);
            setFollowUpMessageRef.current(newMessage);
          } else {
            setLocalMessage((prev) => {
              const newMessage = prev
                ? `${prev}\n\n${imageMarkdown}`
                : imageMarkdown;
              setFollowUpMessageRef.current(newMessage); // Debounced save to scratch
              return newMessage;
            });
          }
        } catch (error) {
          console.error("Failed to upload image:", error);
        }
      }
    },
    [workspaceId]
  );

  // Attachment button - file input ref and handlers
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) {
        handlePasteFiles(files);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [handlePasteFiles]
  );

  // Handler for GitHub comments insertion
  const handleGitHubCommentClick = useCallback(async () => {
    if (!workspaceId) return;
    const repoId = getSelectedRepoId();
    if (!repoId) return;

    const result = await GitHubCommentsDialog.show({
      attemptId: workspaceId,
      repoId,
    });
    if (result.comments.length > 0) {
      // Build markdown for all selected comments
      const markdownBlocks = result.comments.map((comment) => {
        const payload: NormalizedComment = {
          id:
            comment.comment_type === "general"
              ? comment.id
              : comment.id.toString(),
          comment_type: comment.comment_type,
          author: comment.author,
          body: comment.body,
          created_at: comment.created_at,
          url: comment.url,
          // Include review-specific fields when available
          ...(comment.comment_type === "review" && {
            path: comment.path,
            line: comment.line != null ? Number(comment.line) : null,
            diff_hunk: comment.diff_hunk,
          }),
        };
        return "```gh-comment\n" + JSON.stringify(payload, null, 2) + "\n```";
      });

      const markdown = markdownBlocks.join("\n\n");

      // Same pattern as image paste
      if (isQueuedRef.current && queuedMessageRef.current) {
        cancelQueueRef.current();
        const base = queuedMessageRef.current.data.message;
        const newMessage = base ? `${base}\n\n${markdown}` : markdown;
        setLocalMessage(newMessage);
        setFollowUpMessageRef.current(newMessage);
      } else {
        setLocalMessage((prev) => {
          const newMessage = prev ? `${prev}\n\n${markdown}` : markdown;
          setFollowUpMessageRef.current(newMessage);
          return newMessage;
        });
      }
    }
  }, [workspaceId, getSelectedRepoId]);

  // Stable onChange handler for WYSIWYGEditor
  const handleEditorChange = useCallback(
    (value: string) => {
      // Auto-cancel queue when user starts editing
      if (isQueuedRef.current) {
        cancelQueueRef.current();
      }
      setLocalMessage(value); // Immediate update for UI responsiveness
      setFollowUpMessageRef.current(value); // Debounced save to scratch
      if (followUpErrorRef.current) setFollowUpError(null);
    },
    [setFollowUpError]
  );

  // Memoize placeholder to avoid re-renders
  const hasExtraContext = !!(reviewMarkdown || conflictResolutionInstructions);
  const editorPlaceholder = useMemo(
    () =>
      hasExtraContext
        ? "(Optional) Add additional instructions... Type @ to insert tags or search files."
        : "Continue working on this task attempt... Type @ to insert tags or search files.",
    [hasExtraContext]
  );

  // Register keyboard shortcuts
  useKeySubmitFollowUp(handleSubmitShortcut, {
    scope: Scope.FOLLOW_UP_READY,
    enableOnFormTags: ["textarea", "TEXTAREA"],
    when: canSendFollowUp && isEditable,
  });

  // Enable FOLLOW_UP scope when textarea is focused AND editable
  useEffect(() => {
    if (isEditable && isTextareaFocused) {
      enableScope(Scope.FOLLOW_UP);
    } else {
      disableScope(Scope.FOLLOW_UP);
    }
    return () => {
      disableScope(Scope.FOLLOW_UP);
    };
  }, [isEditable, isTextareaFocused, enableScope, disableScope]);

  // Enable FOLLOW_UP_READY scope when ready to send
  useEffect(() => {
    const isReady = isTextareaFocused && isEditable;

    if (isReady) {
      enableScope(Scope.FOLLOW_UP_READY);
    } else {
      disableScope(Scope.FOLLOW_UP_READY);
    }
    return () => {
      disableScope(Scope.FOLLOW_UP_READY);
    };
  }, [isTextareaFocused, isEditable, enableScope, disableScope]);

  // When a process completes (e.g., agent resolved conflicts), refresh branch status promptly
  const prevRunningRef = useRef<boolean>(isAttemptRunning);
  useEffect(() => {
    if (prevRunningRef.current && !isAttemptRunning && workspaceId) {
      refetchBranchStatus();
      refetchAttemptBranch();
    }
    prevRunningRef.current = isAttemptRunning;
  }, [
    isAttemptRunning,
    workspaceId,
    refetchBranchStatus,
    refetchAttemptBranch,
  ]);

  if (!workspaceId) return null;

  if (isScratchLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden",
        isRetryActive && "opacity-50"
      )}
    >
      {/* Scrollable content area */}
      <div className="min-h-0 overflow-y-auto p-4">
        <div className="space-y-2">
          {followUpError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{followUpError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            {/* Review comments preview */}
            {reviewMarkdown && (
              <div className="mb-4">
                <div className="whitespace-pre-wrap break-words rounded-md border bg-muted p-3 text-sm">
                  {reviewMarkdown}
                </div>
              </div>
            )}

            {/* Conflict notice and actions (optional UI) */}
            {branchStatus && (
              <FollowUpConflictSection
                attemptBranch={attemptBranch}
                branchStatus={branchStatus}
                conflictResolutionInstructions={conflictResolutionInstructions}
                enableAbort={canSendFollowUp && !isAttemptRunning}
                enableResolve={
                  canSendFollowUp && !isAttemptRunning && isEditable
                }
                isEditable={isEditable}
                onResolve={onSendFollowUp}
                workspaceId={workspaceId}
              />
            )}

            {/* Clicked elements notice and actions */}
            <ClickedElementsBanner />

            {/* Queued message indicator */}
            {isQueued && queuedMessage && (
              <div className="flex items-center gap-2 rounded-md border bg-muted p-3 text-muted-foreground text-sm">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <div className="font-medium">
                  {t(
                    "followUp.queuedMessage",
                    "Message queued - will execute when current run finishes"
                  )}
                </div>
              </div>
            )}

            <div
              className="flex flex-col gap-2"
              onBlur={(e) => {
                // Only blur if focus is leaving the container entirely
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setIsTextareaFocused(false);
                }
              }}
              onFocus={() => setIsTextareaFocused(true)}
            >
              <Suspense
                fallback={
                  <div className="flex min-h-[40px] items-center justify-center rounded-md border bg-muted/50">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <WYSIWYGEditor
                  className="min-h-[40px]"
                  disabled={!isEditable}
                  onChange={handleEditorChange}
                  onCmdEnter={handleSubmitShortcut}
                  onPasteFiles={handlePasteFiles}
                  placeholder={editorPlaceholder}
                  projectId={projectId}
                  taskAttemptId={workspaceId}
                  value={displayMessage}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* Always-visible action bar */}
      <div className="p-4">
        <div className="flex flex-row items-center gap-2">
          <div className="flex flex-1 gap-2">
            <VariantSelector
              currentProfile={currentProfile}
              disabled={!isEditable}
              onChange={setSelectedVariant}
              selectedVariant={selectedVariant}
            />
          </div>

          {/* Hidden file input for attachment - always present */}
          <input
            accept="image/*"
            className="hidden"
            multiple
            onChange={handleFileInputChange}
            ref={fileInputRef}
            type="file"
          />

          {/* Attach button - always visible */}
          <Button
            aria-label="Attach image"
            disabled={!isEditable}
            onClick={handleAttachClick}
            size="sm"
            title="Attach image"
            variant="outline"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* GitHub Comments button */}
          <Button
            aria-label="Insert GitHub comment"
            disabled={!isEditable}
            onClick={handleGitHubCommentClick}
            size="sm"
            title="Insert GitHub comment"
            variant="outline"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>

          {/* Scripts dropdown - only show if project has any scripts */}
          {hasAnyScript && (
            <DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label="Run scripts"
                        disabled={isAttemptRunning}
                        size="sm"
                        variant="outline"
                      >
                        <Terminal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  {isAttemptRunning && (
                    <TooltipContent side="bottom">
                      {t("followUp.scriptsDisabledWhileRunning")}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRunSetupScript}>
                  {t("followUp.runSetupScript")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRunCleanupScript}>
                  {t("followUp.runCleanupScript")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isAttemptRunning ? (
            <div className="flex items-center gap-2">
              {/* Queue/Cancel Queue button when running */}
              {isQueued ? (
                <Button
                  disabled={isQueueLoading}
                  onClick={cancelQueue}
                  size="sm"
                  variant="outline"
                >
                  {isQueueLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      {t("followUp.cancelQueue", "Cancel Queue")}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  disabled={
                    isQueueLoading ||
                    !(
                      localMessage.trim() ||
                      conflictResolutionInstructions ||
                      reviewMarkdown ||
                      clickedMarkdown
                    )
                  }
                  onClick={handleQueueMessage}
                  size="sm"
                >
                  {isQueueLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      {t("followUp.queue", "Queue")}
                    </>
                  )}
                </Button>
              )}
              <Button
                disabled={isStopping}
                onClick={stopExecution}
                size="sm"
                variant="destructive"
              >
                {isStopping ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <StopCircle className="mr-2 h-4 w-4" />
                    {t("followUp.stop")}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {comments.length > 0 && (
                <Button
                  disabled={!isEditable}
                  onClick={clearComments}
                  size="sm"
                  variant="destructive"
                >
                  {t("followUp.clearReviewComments")}
                </Button>
              )}
              <Button
                disabled={!(canSendFollowUp && isEditable)}
                onClick={onSendFollowUp}
                size="sm"
              >
                {isSendingFollowUp ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {conflictResolutionInstructions
                      ? t("followUp.resolveConflicts")
                      : t("followUp.send")}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
