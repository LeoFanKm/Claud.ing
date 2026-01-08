import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRenameBranch } from "@/hooks/useRenameBranch";
import { defineModal, getErrorMessage } from "@/lib/modals";

export interface EditBranchNameDialogProps {
  attemptId: string;
  currentBranchName: string;
}

export type EditBranchNameDialogResult = {
  action: "confirmed" | "canceled";
  branchName?: string;
};

const EditBranchNameDialogImpl = NiceModal.create<EditBranchNameDialogProps>(
  ({ attemptId, currentBranchName }) => {
    const modal = useModal();
    const { t } = useTranslation(["tasks", "common"]);
    const [branchName, setBranchName] = useState<string>(currentBranchName);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      setBranchName(currentBranchName);
      setError(null);
    }, [currentBranchName]);

    const renameMutation = useRenameBranch(
      attemptId,
      (newBranch) => {
        modal.resolve({
          action: "confirmed",
          branchName: newBranch,
        } as EditBranchNameDialogResult);
        modal.hide();
      },
      (err: unknown) => {
        setError(getErrorMessage(err) || "Failed to rename branch");
      }
    );

    const handleConfirm = () => {
      const trimmedName = branchName.trim();

      if (!trimmedName) {
        setError("Branch name cannot be empty");
        return;
      }

      if (trimmedName === currentBranchName) {
        modal.resolve({ action: "canceled" } as EditBranchNameDialogResult);
        modal.hide();
        return;
      }

      if (trimmedName.includes(" ")) {
        setError("Branch name cannot contain spaces");
        return;
      }

      setError(null);
      renameMutation.mutate(trimmedName);
    };

    const handleCancel = () => {
      modal.resolve({ action: "canceled" } as EditBranchNameDialogResult);
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
            <DialogTitle>{t("editBranchName.dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("editBranchName.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="branch-name">
                {t("editBranchName.dialog.branchNameLabel")}
              </label>
              <Input
                autoFocus
                disabled={renameMutation.isPending}
                id="branch-name"
                onChange={(e) => {
                  setBranchName(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !renameMutation.isPending) {
                    handleConfirm();
                  }
                }}
                placeholder={t("editBranchName.dialog.placeholder")}
                type="text"
                value={branchName}
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={renameMutation.isPending}
              onClick={handleCancel}
              variant="outline"
            >
              {t("common:buttons.cancel")}
            </Button>
            <Button
              disabled={renameMutation.isPending || !branchName.trim()}
              onClick={handleConfirm}
            >
              {renameMutation.isPending
                ? t("editBranchName.dialog.renaming")
                : t("editBranchName.dialog.action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

export const EditBranchNameDialog = defineModal<
  EditBranchNameDialogProps,
  EditBranchNameDialogResult
>(EditBranchNameDialogImpl);
