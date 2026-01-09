/**
 * @file QuickStartSection.tsx
 * @description Quick Start section with multi-agent selector
 *
 * @input Agent configurations, i18n translations
 * @output Rendered Quick Start section with agent selection
 * @position components/landing/QuickStartSection
 */

import { ExternalLink } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  AGENTS,
  DEFAULT_AGENT_ID,
  type AgentConfig,
  getAgentById,
} from "@/constants/agents";
import { SimpleIcon } from "@/constants/AgentIcons";
import { CodeBlock } from "./CodeBlock";

function AgentIcon({
  agent,
  className,
}: { agent: AgentConfig; className?: string }) {
  if (agent.iconPath) {
    return <SimpleIcon className={className} path={agent.iconPath} />;
  }
  return <>{agent.customIcon}</>;
}

export function QuickStartSection() {
  const { t } = useTranslation("landing");
  const [selectedAgentId, setSelectedAgentId] = useState(DEFAULT_AGENT_ID);
  const [copied, setCopied] = useState(false);

  const selectedAgent = getAgentById(selectedAgentId) ?? AGENTS[0];
  const hasCommand =
    selectedAgent.installType === "command" && selectedAgent.command;

  const handleCopy = useCallback(async () => {
    if (!selectedAgent.command) return;

    try {
      await navigator.clipboard.writeText(selectedAgent.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = selectedAgent.command;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedAgent.command]);

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-bold text-2xl text-foreground tracking-tight sm:text-3xl">
          {t("quickStart.title")}
        </h2>
        <p className="mt-3 text-muted-foreground text-sm">
          {t("quickStart.selectAgent")}
        </p>

        {/* Agent Selector */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {AGENTS.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => setSelectedAgentId(agent.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
                selectedAgentId === agent.id
                  ? "border-2 border-foreground bg-foreground text-background font-medium shadow-md"
                  : "border border-border bg-card text-muted-foreground hover:border-foreground/50 hover:text-foreground"
              )}
            >
              <AgentIcon agent={agent} className="h-4 w-4" />
              <span>{agent.name}</span>
            </button>
          ))}
        </div>

        {/* Dynamic Content based on install type */}
        <div className="mt-8 flex justify-center">
          {hasCommand ? (
            <CodeBlock
              className="w-full max-w-md"
              code={selectedAgent.command ?? ""}
              copied={copied}
              onCopy={handleCopy}
            />
          ) : (
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
              <p className="text-muted-foreground text-sm">
                {t(`quickStart.agents.${selectedAgent.id}.installHint`)}
              </p>
              {selectedAgent.url && (
                <a
                  href={selectedAgent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                >
                  {t("quickStart.visitSite")}
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Requirement text */}
        <p className="mt-4 text-muted-foreground text-xs">
          {t(`quickStart.agents.${selectedAgent.id}.requirement`)}
        </p>
      </div>
    </section>
  );
}
