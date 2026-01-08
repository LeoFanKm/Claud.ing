import { AlertCircle, Check, Info, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentAvailabilityState } from "@/hooks/useAgentAvailability";

interface AgentAvailabilityIndicatorProps {
  availability: AgentAvailabilityState;
}

export function AgentAvailabilityIndicator({
  availability,
}: AgentAvailabilityIndicatorProps) {
  const { t } = useTranslation("settings");

  if (!availability) return null;

  return (
    <div className="flex flex-col gap-1 text-sm">
      {availability.status === "checking" && (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">
            {t("settings.agents.availability.checking")}
          </span>
        </div>
      )}
      {availability.status === "login_detected" && (
        <>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span className="text-success">
              {t("settings.agents.availability.loginDetected")}
            </span>
          </div>
          <p className="pl-6 text-muted-foreground text-xs">
            {t("settings.agents.availability.loginDetectedTooltip")}
          </p>
        </>
      )}
      {availability.status === "installation_found" && (
        <>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span className="text-success">
              {t("settings.agents.availability.installationFound")}
            </span>
          </div>
          <p className="pl-6 text-muted-foreground text-xs">
            {t("settings.agents.availability.installationFoundTooltip")}
          </p>
        </>
      )}
      {availability.status === "not_found" && (
        <>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <span className="text-warning">
              {t("settings.agents.availability.notFound")}
            </span>
          </div>
          <p className="pl-6 text-muted-foreground text-xs">
            {t("settings.agents.availability.notFoundTooltip")}
          </p>
        </>
      )}
      {availability.status === "web_mode" && (
        <>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {t("settings.agents.availability.webMode", "Agent detection not available in web mode")}
            </span>
          </div>
          <p className="pl-6 text-muted-foreground text-xs">
            {t("settings.agents.availability.webModeTooltip", "Your selected agent will be used when you run tasks locally")}
          </p>
        </>
      )}
    </div>
  );
}
