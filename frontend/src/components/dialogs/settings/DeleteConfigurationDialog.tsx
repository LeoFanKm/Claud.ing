import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { defineModal } from "@/lib/modals";

export interface DeleteConfigurationDialogProps {
  configName: string;
  executorType: string;
}

export type DeleteConfigurationResult = "deleted" | "canceled";

const DeleteConfigurationDialogImpl =
  NiceModal.create<DeleteConfigurationDialogProps>(
    ({ configName, executorType }) => {
      const modal = useModal();
      const [isDeleting, setIsDeleting] = useState(false);
      const [error, setError] = useState<string | null>(null);

      const handleDelete = async () => {
        setIsDeleting(true);
        setError(null);

        try {
          // Resolve with 'deleted' to let parent handle the deletion
          modal.resolve("deleted" as DeleteConfigurationResult);
          modal.hide();
        } catch (error) {
          setError("Failed to delete configuration. Please try again.");
          setIsDeleting(false);
        }
      };

      const handleCancel = () => {
        modal.resolve("canceled" as DeleteConfigurationResult);
        modal.hide();
      };

      const handleOpenChange = (open: boolean) => {
        if (!open) {
          handleCancel();
        }
      };

      return (
        <Dialog onOpenChange={handleOpenChange} open={modal.visible}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Configuration?</DialogTitle>
              <DialogDescription>
                This will permanently remove "{configName}" from the{" "}
                {executorType} executor. You can't undo this action.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                disabled={isDeleting}
                onClick={handleCancel}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={isDeleting}
                onClick={handleDelete}
                variant="destructive"
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }
  );

export const DeleteConfigurationDialog = defineModal<
  DeleteConfigurationDialogProps,
  DeleteConfigurationResult
>(DeleteConfigurationDialogImpl);
