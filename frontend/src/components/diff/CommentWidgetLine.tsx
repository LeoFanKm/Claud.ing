import { useCallback, useEffect, useMemo, useState } from "react";
import { useHotkeysContext } from "react-hotkeys-hook";
import { Button } from "@/components/ui/button";
import WYSIWYGEditor from "@/components/ui/wysiwyg";
import { type ReviewDraft, useReview } from "@/contexts/ReviewProvider";
import { Scope, useKeyExit, useKeySubmitComment } from "@/keyboard";

interface CommentWidgetLineProps {
  draft: ReviewDraft;
  widgetKey: string;
  onSave: () => void;
  onCancel: () => void;
  projectId?: string;
}

export function CommentWidgetLine({
  draft,
  widgetKey,
  onSave,
  onCancel,
  projectId,
}: CommentWidgetLineProps) {
  const { setDraft, addComment } = useReview();
  const [value, setValue] = useState(draft.text);
  const { enableScope, disableScope } = useHotkeysContext();

  useEffect(() => {
    enableScope(Scope.EDIT_COMMENT);
    return () => {
      disableScope(Scope.EDIT_COMMENT);
    };
  }, [enableScope, disableScope]);

  const handleCancel = useCallback(() => {
    setDraft(widgetKey, null);
    onCancel();
  }, [setDraft, widgetKey, onCancel]);

  const handleSave = useCallback(() => {
    if (value.trim()) {
      addComment({
        filePath: draft.filePath,
        side: draft.side,
        lineNumber: draft.lineNumber,
        text: value.trim(),
        codeLine: draft.codeLine,
      });
    }
    setDraft(widgetKey, null);
    onSave();
  }, [value, draft, setDraft, widgetKey, onSave, addComment]);

  const handleSubmitShortcut = useCallback(
    (e?: KeyboardEvent) => {
      e?.preventDefault();
      handleSave();
    },
    [handleSave]
  );

  const exitOptions = useMemo(
    () => ({
      scope: Scope.EDIT_COMMENT,
    }),
    []
  );

  useKeyExit(handleCancel, exitOptions);

  useKeySubmitComment(handleSubmitShortcut, {
    scope: Scope.EDIT_COMMENT,
    enableOnFormTags: ["textarea", "TEXTAREA"],
    when: value.trim() !== "",
    preventDefault: true,
  });

  return (
    <div className="border-y bg-primary p-4">
      <WYSIWYGEditor
        autoFocus
        className="min-h-[60px] w-full bg-primary font-mono text-primary-foreground text-sm"
        onChange={setValue}
        onCmdEnter={handleSave}
        placeholder="Add a comment... (type @ to search files)"
        projectId={projectId}
        value={value}
      />
      <div className="mt-2 flex gap-2">
        <Button disabled={!value.trim()} onClick={handleSave} size="xs">
          Add review comment
        </Button>
        <Button
          className="text-secondary-foreground"
          onClick={handleCancel}
          size="xs"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
