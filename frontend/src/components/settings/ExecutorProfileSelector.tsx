import type { ExecutorConfig, ExecutorProfileId } from "shared/types";
import { AgentSelector } from "@/components/tasks/AgentSelector";
import { ConfigSelector } from "@/components/tasks/ConfigSelector";
import { cn } from "@/lib/utils";

type Props = {
  profiles: Record<string, ExecutorConfig> | null;
  selectedProfile: ExecutorProfileId | null;
  onProfileSelect: (profile: ExecutorProfileId) => void;
  disabled?: boolean;
  showLabel?: boolean;
  className?: string;
  itemClassName?: string;
};

function ExecutorProfileSelector({
  profiles,
  selectedProfile,
  onProfileSelect,
  disabled = false,
  showLabel = true,
  className,
  itemClassName,
}: Props) {
  if (!profiles) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row", className)}>
      <AgentSelector
        className={itemClassName}
        disabled={disabled}
        onChange={onProfileSelect}
        profiles={profiles}
        selectedExecutorProfile={selectedProfile}
        showLabel={showLabel}
      />
      <ConfigSelector
        className={itemClassName}
        disabled={disabled}
        onChange={onProfileSelect}
        profiles={profiles}
        selectedExecutorProfile={selectedProfile}
        showLabel={showLabel}
      />
    </div>
  );
}

export default ExecutorProfileSelector;
