import { useState } from "react";
import { Button } from "@/components/ui/button";
import WYSIWYGEditor from "@/components/ui/wysiwyg";
import { type ReviewComment, useReview } from "@/contexts/ReviewProvider";

interface ReviewCommentRendererProps {
  comment: ReviewComment;
  projectId?: string;
}

export function ReviewCommentRenderer({
  comment,
  projectId,
}: ReviewCommentRendererProps) {
  const { deleteComment, updateComment } = useReview();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);

  const handleDelete = () => {
    deleteComment(comment.id);
  };

  const handleEdit = () => {
    setEditText(comment.text);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editText.trim()) {
      updateComment(comment.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(comment.text);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="border-y bg-background p-4">
        <WYSIWYGEditor
          autoFocus
          className="min-h-[60px] w-full bg-background font-mono text-foreground text-sm"
          onChange={setEditText}
          onCmdEnter={handleSave}
          placeholder="Edit comment... (type @ to search files)"
          projectId={projectId}
          value={editText}
        />
        <div className="mt-2 flex gap-2">
          <Button disabled={!editText.trim()} onClick={handleSave} size="xs">
            Save changes
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

  return (
    <div className="border-y bg-background p-4">
      <WYSIWYGEditor
        className="text-sm"
        disabled={true}
        onDelete={handleDelete}
        onEdit={handleEdit}
        value={comment.text}
      />
    </div>
  );
}
