/**
 * @file agentIcons.tsx
 * @description Shared AI Agent icon components for landing page
 *
 * @input Agent icon data from simple-icons and custom SVGs
 * @output React components for each agent icon
 * @position constants/agentIcons
 */

import {
  siAnthropic,
  siGithubcopilot,
  siGooglegemini,
  siOpenai,
} from "simple-icons";

// Icon wrapper for simple-icons
export function SimpleIcon({
  path,
  className = "h-8 w-8",
}: {
  path: string;
  className?: string;
}) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}

// Custom SVG icons for agents not in simple-icons
export function CursorIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" />
    </svg>
  );
}

export function AmpIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2L2 19.5h7.5L12 22l2.5-2.5H22L12 2zm0 4.5l5.5 10h-3.7l-1.8 1.8-1.8-1.8H6.5L12 6.5z" />
    </svg>
  );
}

export function QwenIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        fill="none"
        r="10"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        fill="currentColor"
        fontSize="10"
        fontWeight="bold"
        textAnchor="middle"
        x="12"
        y="16"
      >
        Q
      </text>
    </svg>
  );
}

export function OpencodeIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
    </svg>
  );
}

export function FactoryDroidIcon({
  className = "h-8 w-8",
}: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67c-.19-.29-.51-.38-.83-.22-.31.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 002 18h20a10.78 10.78 0 00-4.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
    </svg>
  );
}

// Export simple-icons data for direct use
export const agentIconPaths = {
  anthropic: siAnthropic.path,
  githubCopilot: siGithubcopilot.path,
  googleGemini: siGooglegemini.path,
  openai: siOpenai.path,
};
