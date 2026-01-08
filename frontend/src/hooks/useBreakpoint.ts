import { useEffect, useMemo, useState } from "react";

/**
 * Tailwind CSS breakpoint values
 * @see https://tailwindcss.com/docs/responsive-design
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS | "xs";

/**
 * Get the current breakpoint based on window width
 */
function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS["2xl"]) return "2xl";
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  if (width >= BREAKPOINTS.sm) return "sm";
  return "xs";
}

/**
 * Hook to get current responsive breakpoint
 * Returns the current Tailwind breakpoint name based on window width
 *
 * @example
 * ```tsx
 * const { breakpoint, isMobile, isTablet, isDesktop } = useBreakpoint();
 *
 * if (isMobile) {
 *   return <MobileLayout />;
 * }
 * ```
 */
export function useBreakpoint() {
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : BREAKPOINTS.xl
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    // Use ResizeObserver for better performance when available
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        handleResize();
      });
      observer.observe(document.documentElement);
      return () => observer.disconnect();
    }

    // Fallback to window resize event
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return useMemo(() => {
    const breakpoint = getBreakpoint(width);

    return {
      /** Current breakpoint name: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' */
      breakpoint,
      /** Current window width in pixels */
      width,
      /** True for xs and sm breakpoints (< 768px) */
      isMobile: breakpoint === "xs" || breakpoint === "sm",
      /** True for md breakpoint (768px - 1023px) */
      isTablet: breakpoint === "md",
      /** True for lg, xl, 2xl breakpoints (>= 1024px) */
      isDesktop:
        breakpoint === "lg" || breakpoint === "xl" || breakpoint === "2xl",
      /** True for md and lg breakpoints (768px - 1279px) - useful for compact layouts */
      isCompact: breakpoint === "md" || breakpoint === "lg",
      /** Check if current breakpoint is at least the specified size */
      isAtLeast: (bp: keyof typeof BREAKPOINTS) => width >= BREAKPOINTS[bp],
      /** Check if current breakpoint is at most the specified size */
      isAtMost: (bp: keyof typeof BREAKPOINTS) => width < BREAKPOINTS[bp],
    };
  }, [width]);
}

export type UseBreakpointReturn = ReturnType<typeof useBreakpoint>;
