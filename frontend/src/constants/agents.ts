/**
 * @file agents.ts
 * @description AI Agent configuration for Quick Start section
 *
 * @input Agent metadata including install commands and types
 * @output Agent configuration array for UI rendering
 * @position constants/agents
 */

import type { ReactNode } from "react";
import {
  AmpIcon,
  CursorIcon,
  FactoryDroidIcon,
  OpencodeIcon,
  QwenIcon,
  agentIconPaths,
} from "./AgentIcons";

export type AgentInstallType = "command" | "app" | "extension";

export interface AgentConfig {
  id: string;
  name: string;
  iconPath?: string; // For simple-icons SVG path
  customIcon?: ReactNode; // For custom React components
  installType: AgentInstallType;
  command?: string; // CLI install command
  url?: string; // Official website
}

export const AGENTS: AgentConfig[] = [
  {
    id: "claude_code",
    name: "Claude Code",
    iconPath: agentIconPaths.anthropic,
    installType: "command",
    command: "npx @anthropic-ai/claude-code",
    url: "https://claude.ai/code",
  },
  {
    id: "cursor",
    name: "Cursor",
    customIcon: CursorIcon({ className: "h-5 w-5" }),
    installType: "app",
    url: "https://cursor.sh",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    iconPath: agentIconPaths.githubCopilot,
    installType: "extension",
    url: "https://github.com/features/copilot",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    iconPath: agentIconPaths.googleGemini,
    installType: "command",
    command: "npx @anthropic-ai/gemini-cli",
    url: "https://ai.google.dev",
  },
  {
    id: "codex",
    name: "OpenAI Codex",
    iconPath: agentIconPaths.openai,
    installType: "command",
    command: "npx openai-codex@latest",
    url: "https://openai.com",
  },
  {
    id: "amp",
    name: "Amp",
    customIcon: AmpIcon({ className: "h-5 w-5" }),
    installType: "command",
    command: "npx amp@latest",
    url: "https://amp.dev",
  },
  {
    id: "qwen",
    name: "Qwen",
    customIcon: QwenIcon({ className: "h-5 w-5" }),
    installType: "command",
    command: "npx qwen-code@latest",
    url: "https://qwen.ai",
  },
  {
    id: "opencode",
    name: "Opencode",
    customIcon: OpencodeIcon({ className: "h-5 w-5" }),
    installType: "command",
    command: "npx opencode@latest",
    url: "https://opencode.dev",
  },
  {
    id: "droid",
    name: "Factory Droid",
    customIcon: FactoryDroidIcon({ className: "h-5 w-5" }),
    installType: "command",
    command: "npx @anthropic-ai/factory-droid",
    url: "https://factory.ai",
  },
];

// Default agent for initial selection
export const DEFAULT_AGENT_ID = "claude_code";

// Get agent by ID
export function getAgentById(id: string): AgentConfig | undefined {
  return AGENTS.find((agent) => agent.id === id);
}
