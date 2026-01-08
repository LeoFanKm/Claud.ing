import { Cpu, FolderLock, GitPullRequest, Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatedSection } from "./AnimatedSection";
import { FeatureCard } from "./FeatureCard";

const features = [
  {
    key: "parallelExecution",
    icon: Cpu,
  },
  {
    key: "isolatedWorkspaces",
    icon: FolderLock,
  },
  {
    key: "codeReview",
    icon: GitPullRequest,
  },
  {
    key: "mcpIntegration",
    icon: Puzzle,
  },
] as const;

export function FeaturesSection() {
  const { t } = useTranslation("landing");

  return (
    <section className="scroll-mt-16 py-20" id="features">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mb-12 text-center">
          <h2 className="mb-4 font-bold text-3xl text-foreground tracking-tight sm:text-4xl">
            {t("features.title")}
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            {t("features.subtitle")}
          </p>
        </AnimatedSection>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <FeatureCard
              delay={0.1 + index * 0.1}
              description={t(`features.${feature.key}.description`)}
              icon={feature.icon}
              key={feature.key}
              title={t(`features.${feature.key}.title`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
