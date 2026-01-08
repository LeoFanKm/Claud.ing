import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    icon: "w-5 h-5",
    text: "text-sm",
    gap: "gap-1.5",
  },
  md: {
    icon: "w-6 h-6",
    text: "text-lg",
    gap: "gap-2",
  },
  lg: {
    icon: "w-8 h-8",
    text: "text-xl",
    gap: "gap-2.5",
  },
};

/**
 * Kanban board icon - 3 columns with cards
 * Clean, minimal design representing a kanban workflow
 */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Column 1 - 2 cards */}
      <rect
        className="fill-primary"
        height="7"
        rx="1"
        width="5.5"
        x="2"
        y="3"
      />
      <rect
        className="fill-primary/60"
        height="5"
        rx="1"
        width="5.5"
        x="2"
        y="11.5"
      />

      {/* Column 2 - 3 cards (in progress) */}
      <rect
        className="fill-primary"
        height="4.5"
        rx="1"
        width="5.5"
        x="9.25"
        y="3"
      />
      <rect
        className="fill-primary/80"
        height="5"
        rx="1"
        width="5.5"
        x="9.25"
        y="9"
      />
      <rect
        className="fill-primary/40"
        height="5.5"
        rx="1"
        width="5.5"
        x="9.25"
        y="15.5"
      />

      {/* Column 3 - 2 cards (done) */}
      <rect
        className="fill-primary/70"
        height="6"
        rx="1"
        width="5.5"
        x="16.5"
        y="3"
      />
      <rect
        className="fill-primary/50"
        height="4.5"
        rx="1"
        width="5.5"
        x="16.5"
        y="10.5"
      />
    </svg>
  );
}

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        "flex items-center font-semibold",
        config.gap,
        config.text,
        className
      )}
    >
      <LogoIcon className={config.icon} />
      {showText && (
        <>
          <span className="text-foreground">Kanban</span>
          <span className="text-[0.65em] text-muted-foreground">by</span>
          <span className="font-bold text-foreground">Claud.ing</span>
        </>
      )}
    </div>
  );
}

/**
 * Standalone logo icon for favicon/PWA use
 * Exports as pure SVG string for use in public assets
 */
export const logoIconSvg = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="3" width="5.5" height="7" rx="1" fill="#6366f1"/>
  <rect x="2" y="11.5" width="5.5" height="5" rx="1" fill="#6366f1" opacity="0.6"/>
  <rect x="9.25" y="3" width="5.5" height="4.5" rx="1" fill="#6366f1"/>
  <rect x="9.25" y="9" width="5.5" height="5" rx="1" fill="#6366f1" opacity="0.8"/>
  <rect x="9.25" y="15.5" width="5.5" height="5.5" rx="1" fill="#6366f1" opacity="0.4"/>
  <rect x="16.5" y="3" width="5.5" height="6" rx="1" fill="#6366f1" opacity="0.7"/>
  <rect x="16.5" y="10.5" width="5.5" height="4.5" rx="1" fill="#6366f1" opacity="0.5"/>
</svg>`;
