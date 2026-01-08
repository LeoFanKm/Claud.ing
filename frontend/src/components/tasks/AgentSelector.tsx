import { ArrowDown, Bot } from "lucide-react";
import type { BaseCodingAgent, ExecutorProfileId } from "shared/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

interface AgentSelectorProps {
  profiles: Record<string, Record<string, unknown>> | null;
  selectedExecutorProfile: ExecutorProfileId | null;
  onChange: (profile: ExecutorProfileId) => void;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
}

export function AgentSelector({
  profiles,
  selectedExecutorProfile,
  onChange,
  disabled,
  className = "",
  showLabel = false,
}: AgentSelectorProps) {
  const agents = profiles
    ? (Object.keys(profiles).sort() as BaseCodingAgent[])
    : [];
  const selectedAgent = selectedExecutorProfile?.executor;

  if (!profiles) return null;

  return (
    <div className="flex-1">
      {showLabel && (
        <Label className="font-medium text-sm" htmlFor="executor-profile">
          Agent
        </Label>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Select agent"
            className={`w-full justify-between text-xs ${showLabel ? "mt-1.5" : ""} ${className}`}
            disabled={disabled}
            size="sm"
            variant="outline"
          >
            <div className="flex w-full items-center gap-1.5">
              <Bot className="h-3 w-3" />
              <span className="truncate">{selectedAgent || "Agent"}</span>
            </div>
            <ArrowDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          {agents.length === 0 ? (
            <div className="p-2 text-center text-muted-foreground text-sm">
              No agents available
            </div>
          ) : (
            agents.map((agent) => (
              <DropdownMenuItem
                className={selectedAgent === agent ? "bg-accent" : ""}
                key={agent}
                onClick={() => {
                  onChange({
                    executor: agent,
                    variant: null,
                  });
                }}
              >
                {agent}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
