import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useState } from "react";
import type { TaskWithAttemptStatus } from "shared/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tasksApi } from "@/lib/api";
import { defineModal } from "@/lib/modals";

export interface DeleteTaskConfirmationDialogProps {
  task: TaskWithAttemptStatus;
  projectId: string;
}

const DeleteTaskConfirmationDialogImpl =
  NiceModal.create<DeleteTaskConfirmationDialogProps>(({ task }) => {
    const modal = useModal();
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirmDelete = async () => {
      setIsDeleting(true);
      setError(null);

      try {
        await tasksApi.delete(task.id);
        modal.resolve();
        modal.hide();
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete task";
        setError(errorMessage);
      } finally {
        setIsDeleting(false);
      }
    };

    const handleCancelDelete = () => {
      modal.reject();
      modal.hide();
    };

    return (
      <Dialog
        onOpenChange={(open) => !open && handleCancelDelete()}
        open={modal.visible}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">"{task.title}"</span>?
            </DialogDescription>
          </DialogHeader>

          <Alert className="mb-4" variant="destructive">
            <strong>Warning:</strong> This action will permanently delete the
            task and cannot be undone.
          </Alert>

          {error && (
            <Alert className="mb-4" variant="destructive">
              {error}
            </Alert>
          )}

          <DialogFooter>
            <Button
              autoFocus
              disabled={isDeleting}
              onClick={handleCancelDelete}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              variant="destructive"
            >
              {isDeleting ? "Deleting..." : "Delete Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  });

export const DeleteTaskConfirmationDialog = defineModal<
  DeleteTaskConfirmationDialogProps,
  void
>(DeleteTaskConfirmationDialogImpl);
