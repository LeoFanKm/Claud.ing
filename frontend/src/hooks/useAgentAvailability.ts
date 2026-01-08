import { useEffect, useState } from "react";
import type { BaseCodingAgent } from "shared/types";
import { configApi, isRemoteApiEnabled } from "../lib/api";

export type AgentAvailabilityState =
  | { status: "checking" }
  | { status: "login_detected" }
  | { status: "installation_found" }
  | { status: "not_found" }
  | { status: "web_mode" }
  | null;

/**
 * Hook to check if an agent is available on the system.
 * Returns { status: "web_mode" } in remote/web mode (can't check local installation).
 */
export function useAgentAvailability(
  agent: BaseCodingAgent | null | undefined
): AgentAvailabilityState {
  const [availability, setAvailability] =
    useState<AgentAvailabilityState>(null);

  useEffect(() => {
    if (!agent) {
      setAvailability(null);
      return;
    }

    // In web mode, local agent detection is not available
    if (isRemoteApiEnabled) {
      setAvailability({ status: "web_mode" });
      return;
    }

    const checkAvailability = async () => {
      setAvailability({ status: "checking" });
      try {
        const info = await configApi.checkAgentAvailability(agent);

        // Map backend enum to frontend state
        switch (info.type) {
          case "LOGIN_DETECTED":
            setAvailability({ status: "login_detected" });
            break;
          case "INSTALLATION_FOUND":
            setAvailability({ status: "installation_found" });
            break;
          case "NOT_FOUND":
            setAvailability({ status: "not_found" });
            break;
        }
      } catch (error) {
        console.error("Failed to check agent availability:", error);
        setAvailability(null);
      }
    };

    checkAvailability();
  }, [agent]);

  return availability;
}
