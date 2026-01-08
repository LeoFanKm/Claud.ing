/**
 * @file AgentSupportSection.tsx
 * @description Displays supported AI agents with animated cards
 *
 * @input Agent icons from shared constants
 * @output Rendered agent support section with clickable cards
 * @position components/landing/AgentSupportSection
 */

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AmpIcon,
  CursorIcon,
  FactoryDroidIcon,
  OpencodeIcon,
  QwenIcon,
  SimpleIcon,
  agentIconPaths,
} from "@/constants/AgentIcons";
import { AnimatedSection } from "./AnimatedSection";

interface Agent {
  name: string;
  iconPath?: string;
  customIcon?: React.ReactNode;
  url?: string;
}

const agents: Agent[] = [
  {
    name: "Claude Code",
    iconPath: agentIconPaths.anthropic,
    url: "https://claude.ai/code",
  },
  {
    name: "Cursor",
    customIcon: <CursorIcon />,
    url: "https://cursor.sh",
  },
  {
    name: "GitHub Copilot",
    iconPath: agentIconPaths.githubCopilot,
    url: "https://github.com/features/copilot",
  },
  {
    name: "Gemini CLI",
    iconPath: agentIconPaths.googleGemini,
    url: "https://ai.google.dev",
  },
  {
    name: "OpenAI",
    iconPath: agentIconPaths.openai,
    url: "https://openai.com",
  },
  {
    name: "Amp",
    customIcon: <AmpIcon />,
    url: "https://amp.dev",
  },
  {
    name: "Qwen",
    customIcon: <QwenIcon />,
    url: "https://qwen.ai",
  },
  {
    name: "Opencode",
    customIcon: <OpencodeIcon />,
    url: "https://opencode.dev",
  },
  {
    name: "Factory Droid",
    customIcon: <FactoryDroidIcon />,
    url: "https://factory.ai",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
    },
  },
};

function AgentCard({ agent }: { agent: Agent }) {
  const CardContent = (
    <motion.div
      className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-border hover:bg-card/80 hover:shadow-lg"
      variants={itemVariants}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        {agent.iconPath ? (
          <SimpleIcon path={agent.iconPath} />
        ) : (
          agent.customIcon
        )}
      </div>
      <span className="font-medium text-foreground text-sm">{agent.name}</span>
    </motion.div>
  );

  if (agent.url) {
    return (
      <a
        className="rounded-xl outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        href={agent.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {CardContent}
      </a>
    );
  }

  return CardContent;
}

export function AgentSupportSection() {
  const { t } = useTranslation("landing");

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center">
          <h2 className="font-bold text-3xl text-foreground tracking-tight sm:text-4xl">
            {t("agentSupport.title", "Works with Your Favorite AI Agents")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t(
              "agentSupport.subtitle",
              "Seamlessly integrate with the leading AI coding assistants and agents"
            )}
          </p>
        </AnimatedSection>

        <motion.div
          className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
          initial="hidden"
          variants={containerVariants}
          viewport={{ once: true, margin: "-50px" }}
          whileInView="visible"
        >
          {agents.map((agent) => (
            <AgentCard agent={agent} key={agent.name} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
