import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import type { RepoBranchConfig } from "@/hooks";
import BranchSelector from "./BranchSelector";

type Props = {
  configs: RepoBranchConfig[];
  onBranchChange: (repoId: string, branch: string) => void;
  isLoading?: boolean;
  showLabel?: boolean;
  className?: string;
};

export function RepoBranchSelector({
  configs,
  onBranchChange,
  isLoading,
  showLabel = true,
  className,
}: Props) {
  const { t } = useTranslation("tasks");

  if (configs.length === 0) {
    return null;
  }

  if (configs.length === 1) {
    const config = configs[0];
    return (
      <div className={className}>
        {showLabel && (
          <Label className="font-medium text-sm">
            {t("repoBranchSelector.label")}{" "}
            <span className="text-destructive">*</span>
          </Label>
        )}
        <BranchSelector
          branches={config.branches}
          onBranchSelect={(branch) => onBranchChange(config.repoId, branch)}
          placeholder={
            isLoading
              ? t("createAttemptDialog.loadingBranches")
              : t("createAttemptDialog.selectBranch")
          }
          selectedBranch={config.targetBranch}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        {configs.map((config) => (
          <div className="space-y-1" key={config.repoId}>
            <Label className="font-medium text-sm">
              {config.repoDisplayName}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <BranchSelector
              branches={config.branches}
              onBranchSelect={(branch) => onBranchChange(config.repoId, branch)}
              placeholder={
                isLoading
                  ? t("createAttemptDialog.loadingBranches")
                  : t("createAttemptDialog.selectBranch")
              }
              selectedBranch={config.targetBranch}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default RepoBranchSelector;
