import { useClerk } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { OAuthDialog } from "@/components/dialogs/global/OAuthDialog";
import { Button } from "@/components/ui/button";
import { useClerkEnabled, useClerkLoaded } from "@/contexts/ClerkContext";
import { useLandingAuth } from "@/hooks";

// AI agents that rotate in the hero title
const AI_AGENTS = [
  "Claude Code",
  "Cursor",
  "Windsurf",
  "Gemini CLI",
  "GitHub Copilot",
  "Amp",
  "Opencode",
  "Augment",
  "Roo Code",
];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

// Animation for rotating text
const rotatingTextVariants = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

interface HeroSectionProps {
  version?: string;
}

// Inner component that handles Clerk-specific login (only rendered when Clerk is loaded)
function HeroSectionWithClerk({
  version,
  onGetStarted,
}: {
  version: string;
  onGetStarted: (openSignIn: () => void) => void;
}) {
  const { openSignIn } = useClerk();

  const handleClick = useCallback(() => {
    onGetStarted(() => {
      openSignIn({
        afterSignInUrl: "/projects",
        afterSignUpUrl: "/projects",
      });
    });
  }, [onGetStarted, openSignIn]);

  return <HeroSectionContent onCtaClick={handleClick} version={version} />;
}

// Component for legacy OAuth flow (used when Clerk is disabled or loading)
function HeroSectionLegacy({ version }: { version: string }) {
  const { isSignedIn } = useLandingAuth();
  const navigate = useNavigate();

  const handleClick = useCallback(async () => {
    if (isSignedIn) {
      navigate("/projects");
      return;
    }

    // Show OAuth dialog and wait for completion
    const result = await OAuthDialog.show();
    if (result) {
      // Login successful, navigate to projects
      navigate("/projects");
    }
  }, [isSignedIn, navigate]);

  return <HeroSectionContent onCtaClick={handleClick} version={version} />;
}

export function HeroSection({ version = "0.0.143" }: HeroSectionProps) {
  const isClerkEnabled = useClerkEnabled();
  const isClerkLoaded = useClerkLoaded();
  const { isSignedIn } = useLandingAuth();
  const navigate = useNavigate();

  const handleGetStarted = useCallback(
    (openSignIn: () => void) => {
      if (isSignedIn) {
        navigate("/projects");
        return;
      }
      openSignIn();
    },
    [isSignedIn, navigate]
  );

  // Use Clerk flow only when Clerk is enabled AND loaded
  if (isClerkEnabled && isClerkLoaded) {
    return (
      <HeroSectionWithClerk onGetStarted={handleGetStarted} version={version} />
    );
  }

  // Use legacy flow when Clerk is disabled or still loading
  return <HeroSectionLegacy version={version} />;
}

function HeroSectionContent({
  version = "0.0.143",
  onCtaClick,
}: {
  version?: string;
  onCtaClick: () => void;
}) {
  const { t } = useTranslation("landing");
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0);

  // Rotate through AI agents every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAgentIndex((prev) => (prev + 1) % AI_AGENTS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/2 right-0 h-[400px] w-[400px] translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <motion.div
        animate="visible"
        className="mx-auto max-w-4xl text-center"
        initial="hidden"
        variants={staggerContainer}
      >
        {/* Version Badge */}
        <motion.div className="mb-6 inline-flex" variants={fadeInUp}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 font-medium text-foreground text-sm">
            <Sparkles className="h-3.5 w-3.5" />
            {t("hero.badge", { version })}
          </span>
        </motion.div>

        {/* Title with rotating AI agent name */}
        <motion.h1
          className="mb-6 font-bold text-4xl text-foreground tracking-tight sm:text-5xl lg:text-6xl"
          variants={fadeInUp}
        >
          {t("hero.titlePrefix")}{" "}
          <span className="relative inline-block min-w-[200px] sm:min-w-[280px]">
            <span className="inline-flex items-center justify-center rounded-md border-2 border-muted-foreground/30 border-dashed px-3 py-1 sm:px-4 sm:py-2">
              <AnimatePresence mode="wait">
                <motion.span
                  animate="center"
                  className="font-bold text-foreground"
                  exit="exit"
                  initial="enter"
                  key={currentAgentIndex}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  variants={rotatingTextVariants}
                >
                  {AI_AGENTS[currentAgentIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          variants={fadeInUp}
        >
          {t("hero.subtitle")}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          variants={fadeInUp}
        >
          <Button className="gap-2" onClick={onCtaClick} size="lg">
            {t("hero.cta")}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#features">{t("hero.learnMore")}</a>
          </Button>
        </motion.div>

        {/* Testimonial */}
        <motion.blockquote
          className="mx-auto mt-16 max-w-xl"
          variants={fadeInUp}
        >
          <p className="text-lg text-muted-foreground italic">
            "{t("hero.testimonial.quote")}"
          </p>
          <footer className="mt-4 text-sm">
            <span className="font-semibold text-foreground">
              {t("hero.testimonial.author")}
            </span>
            <span className="text-muted-foreground">
              {" — "}
              {t("hero.testimonial.role")}
            </span>
          </footer>
        </motion.blockquote>
      </motion.div>
    </section>
  );
}
