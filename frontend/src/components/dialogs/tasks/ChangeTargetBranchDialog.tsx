import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GitBranch } from "shared/types";
import BranchSelector from "@/components/tasks/BranchSelector";
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

export interface ChangeTargetBranchDialogProps {
  branches: GitBranch[];
  isChangingTargetBranch?: boolean;
}

export type ChangeTargetBranchDialogResult = {
  action: "confirmed" | "canceled";
  branchName?: string;
};

const ChangeTargetBranchDialogImpl =
  NiceModal.create<ChangeTargetBranchDialogProps>(
    ({ branches, isChangingTargetBranch = false }) => {
      const modal = useModal();
      const { t } = useTranslation(["tasks", "common"]);
      const [selectedBranch, setSelectedBranch] = useState<string>("");

      const handleConfirm = () => {
        if (selectedBranch) {
          modal.resolve({
            action: "confirmed",
            branchName: selectedBranch,
          } as ChangeTargetBranchDialogResult);
          modal.hide();
        }
      };

      const handleCancel = () => {
        modal.resolve({ action: "canceled" } as ChangeTargetBranchDialogResult);
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
              <DialogTitle>
                {t("branches.changeTarget.dialog.title")}
              </DialogTitle>
              <DialogDescription>
                {t("branches.changeTarget.dialog.description")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="base-branch">
                  {t("rebase.dialog.targetLabel")}
                </label>
                <BranchSelector
                  branches={branches}
                  excludeCurrentBranch={false}
                  onBranchSelect={setSelectedBranch}
                  placeholder={t("branches.changeTarget.dialog.placeholder")}
                  selectedBranch={selectedBranch}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                disabled={isChangingTargetBranch}
                onClick={handleCancel}
                variant="outline"
              >
                {t("common:buttons.cancel")}
              </Button>
              <Button
                disabled={isChangingTargetBranch || !selectedBranch}
                onClick={handleConfirm}
              >
                {isChangingTargetBranch
                  ? t("branches.changeTarget.dialog.inProgress")
                  : t("branches.changeTarget.dialog.action")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }
  );

export const ChangeTargetBranchDialog = defineModal<
  ChangeTargetBranchDialogProps,
  ChangeTargetBranchDialogResult
>(ChangeTargetBranchDialogImpl);
