import { ArrowDown, Settings2 } from "lucide-react";
import type { ExecutorProfileId } from "shared/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

interface ConfigSelectorProps {
  profiles: Record<string, Record<string, unknown>> | null;
  selectedExecutorProfile: ExecutorProfileId | null;
  onChange: (profile: ExecutorProfileId) => void;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
}

export function ConfigSelector({
  profiles,
  selectedExecutorProfile,
  onChange,
  disabled,
  className = "",
  showLabel = false,
}: ConfigSelectorProps) {
  const selectedAgent = selectedExecutorProfile?.executor;
  const configs = selectedAgent && profiles ? profiles[selectedAgent] : null;
  const configOptions = configs ? Object.keys(configs).sort() : [];
  const selectedVariant = selectedExecutorProfile?.variant || "DEFAULT";

  if (
    !(selectedAgent && profiles && configs) ||
    Object.keys(configs).length === 0
  )
    return null;

  return (
    <div className="flex-1">
      {showLabel && (
        <Label className="font-medium text-sm" htmlFor="executor-variant">
          Configuration
        </Label>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Select configuration"
            className={`w-full justify-between text-xs ${showLabel ? "mt-1.5" : ""} ${className}`}
            disabled={disabled}
            size="sm"
            variant="outline"
          >
            <div className="flex w-full items-center gap-1.5">
              <Settings2 className="h-3 w-3" />
              <span className="truncate">{selectedVariant}</span>
            </div>
            <ArrowDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          {configOptions.map((variant) => (
            <DropdownMenuItem
              className={
                (variant === "DEFAULT" ? null : variant) ===
                selectedExecutorProfile?.variant
                  ? "bg-accent"
                  : ""
              }
              key={variant}
              onClick={() => {
                onChange({
                  executor: selectedAgent,
                  variant: variant === "DEFAULT" ? null : variant,
                });
              }}
            >
              {variant}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
