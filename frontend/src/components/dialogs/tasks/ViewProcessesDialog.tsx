import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useTranslation } from "react-i18next";
import ProcessesTab from "@/components/tasks/TaskDetails/ProcessesTab";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProcessSelectionProvider } from "@/contexts/ProcessSelectionContext";
import { defineModal } from "@/lib/modals";

export interface ViewProcessesDialogProps {
  attemptId: string;
  initialProcessId?: string | null;
}

const ViewProcessesDialogImpl = NiceModal.create<ViewProcessesDialogProps>(
  ({ attemptId, initialProcessId }) => {
    const { t } = useTranslation("tasks");
    const modal = useModal();

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        modal.hide();
      }
    };

    return (
      <Dialog
        className="w-[92vw] max-w-5xl overflow-x-hidden p-0"
        onOpenChange={handleOpenChange}
        open={modal.visible}
      >
        <DialogContent
          className="min-w-0 p-0"
          onKeyDownCapture={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              modal.hide();
            }
          }}
        >
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t("viewProcessesDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex h-[75vh] min-h-0 min-w-0 flex-col">
            <ProcessSelectionProvider initialProcessId={initialProcessId}>
              <ProcessesTab attemptId={attemptId} />
            </ProcessSelectionProvider>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

export const ViewProcessesDialog = defineModal<ViewProcessesDialogProps, void>(
  ViewProcessesDialogImpl
);
