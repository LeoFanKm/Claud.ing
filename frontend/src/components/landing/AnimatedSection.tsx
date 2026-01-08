import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedSectionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function AnimatedSection({
  children,
  delay = 0,
  className,
}: AnimatedSectionProps) {
  return (
    <motion.div
      className={cn(className)}
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
      {children}
    </motion.div>
  );
}
