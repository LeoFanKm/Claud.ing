import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
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

export interface RebaseDialogProps {
  branches: GitBranch[];
  isRebasing?: boolean;
  initialTargetBranch?: string;
  initialUpstreamBranch?: string;
}

export type RebaseDialogResult = {
  action: "confirmed" | "canceled";
  branchName?: string;
  upstreamBranch?: string;
};

const RebaseDialogImpl = NiceModal.create<RebaseDialogProps>(
  ({
    branches,
    isRebasing = false,
    initialTargetBranch,
    initialUpstreamBranch,
  }) => {
    const modal = useModal();
    const { t } = useTranslation(["tasks", "common"]);
    const [selectedBranch, setSelectedBranch] = useState<string>(
      initialTargetBranch ?? ""
    );
    const [selectedUpstream, setSelectedUpstream] = useState<string>(
      initialUpstreamBranch ?? ""
    );

    useEffect(() => {
      if (initialTargetBranch) {
        setSelectedBranch(initialTargetBranch);
      }
    }, [initialTargetBranch]);

    useEffect(() => {
      if (initialUpstreamBranch) {
        setSelectedUpstream(initialUpstreamBranch);
      }
    }, [initialUpstreamBranch]);

    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleConfirm = () => {
      if (selectedBranch) {
        modal.resolve({
          action: "confirmed",
          branchName: selectedBranch,
          upstreamBranch: selectedUpstream,
        } as RebaseDialogResult);
        modal.hide();
      }
    };

    const handleCancel = () => {
      modal.resolve({ action: "canceled" } as RebaseDialogResult);
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
            <DialogTitle>{t("rebase.dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("rebase.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="target-branch">
                {t("rebase.dialog.targetLabel")}
              </label>
              <BranchSelector
                branches={branches}
                excludeCurrentBranch={false}
                onBranchSelect={setSelectedBranch}
                placeholder={t("rebase.dialog.targetPlaceholder")}
                selectedBranch={selectedBranch}
              />
            </div>
            <div className="space-y-2">
              <button
                className="flex w-full items-center gap-2 text-left text-muted-foreground text-sm transition-colors hover:text-foreground"
                onClick={() => setShowAdvanced((prev) => !prev)}
                type="button"
              >
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                />
                <span>{t("rebase.dialog.advanced")}</span>
              </button>
              {showAdvanced && (
                <div className="space-y-2">
                  <label
                    className="font-medium text-sm"
                    htmlFor="upstream-branch"
                  >
                    {t("rebase.dialog.upstreamLabel")}
                  </label>
                  <BranchSelector
                    branches={branches}
                    excludeCurrentBranch={false}
                    onBranchSelect={setSelectedUpstream}
                    placeholder={t("rebase.dialog.upstreamPlaceholder")}
                    selectedBranch={selectedUpstream}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={isRebasing}
              onClick={handleCancel}
              variant="outline"
            >
              {t("common:buttons.cancel")}
            </Button>
            <Button
              disabled={isRebasing || !selectedBranch}
              onClick={handleConfirm}
            >
              {isRebasing
                ? t("rebase.common.inProgress")
                : t("rebase.common.action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

export const RebaseDialog = defineModal<RebaseDialogProps, RebaseDialogResult>(
  RebaseDialogImpl
);
