import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  delay?: number;
  className?: string;
}

const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function FeatureCard({
  icon: Icon,
  title,
  description,
  delay = 0,
  className,
}: FeatureCardProps) {
  return (
    <motion.div
      className={cn(
        "group rounded-xl border border-border/50 bg-card p-6",
        "transition-colors hover:border-border hover:bg-card/80",
        className
      )}
      initial="hidden"
      transition={{
        duration: 0.5,
        delay,
        ease: "easeOut",
      }}
      variants={variants}
      viewport={{ once: true, margin: "-50px" }}
      whileInView="visible"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-2 font-semibold text-foreground text-lg">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
