import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  siAnthropic,
  siGithubcopilot,
  siGooglegemini,
  siOpenai,
} from "simple-icons";
import { AnimatedSection } from "./AnimatedSection";

interface Agent {
  name: string;
  icon?: {
    path: string;
    hex: string;
  };
  customIcon?: React.ReactNode;
  url?: string;
}

// Custom SVG icons for agents not in simple-icons
const CursorIcon = () => (
  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
    <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" />
  </svg>
);

const AmpIcon = () => (
  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2L2 19.5h7.5L12 22l2.5-2.5H22L12 2zm0 4.5l5.5 10h-3.7l-1.8 1.8-1.8-1.8H6.5L12 6.5z" />
  </svg>
);

const QwenIcon = () => (
  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
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

const OpencodeIcon = () => (
  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
  </svg>
);

const FactoryDroidIcon = () => (
  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67c-.19-.29-.51-.38-.83-.22-.31.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 002 18h20a10.78 10.78 0 00-4.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
  </svg>
);

const agents: Agent[] = [
  {
    name: "Claude Code",
    icon: { path: siAnthropic.path, hex: siAnthropic.hex },
    url: "https://claude.ai/code",
  },
  {
    name: "Cursor",
    customIcon: <CursorIcon />,
    url: "https://cursor.sh",
  },
  {
    name: "GitHub Copilot",
    icon: { path: siGithubcopilot.path, hex: siGithubcopilot.hex },
    url: "https://github.com/features/copilot",
  },
  {
    name: "Gemini CLI",
    icon: { path: siGooglegemini.path, hex: siGooglegemini.hex },
    url: "https://ai.google.dev",
  },
  {
    name: "OpenAI",
    icon: { path: siOpenai.path, hex: siOpenai.hex },
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
        {agent.icon ? (
          <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
            <path d={agent.icon.path} />
          </svg>
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
