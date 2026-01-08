/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "node_modules/@rjsf/shadcn/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // Responsive breakpoint utilities for dynamic layouts
    "sm:hidden",
    "md:hidden",
    "lg:hidden",
    "xl:hidden",
    "2xl:hidden",
    "sm:block",
    "md:block",
    "lg:block",
    "xl:block",
    "2xl:block",
    "sm:flex",
    "md:flex",
    "lg:flex",
    "xl:flex",
    "2xl:flex",
    "sm:relative",
    "md:relative",
    "lg:relative",
    "xl:relative",
    "sm:inset-auto",
    "md:inset-auto",
    "lg:inset-auto",
    "xl:inset-auto",
    "sm:z-auto",
    "md:z-auto",
    "lg:z-auto",
    "xl:z-auto",
    "sm:h-full",
    "md:h-full",
    "lg:h-full",
    "xl:h-full",
    "sm:w-full",
    "md:w-full",
    "lg:w-full",
    "xl:w-full",
    "xl:w-[800px]",
    "sm:flex-1",
    "md:flex-1",
    "lg:flex-1",
    "xl:flex-1",
    "sm:min-w-0",
    "md:min-w-0",
    "lg:min-w-0",
    "xl:min-w-0",
    "sm:overflow-y-auto",
    "md:overflow-y-auto",
    "lg:overflow-y-auto",
    "xl:overflow-y-auto",
    "sm:opacity-100",
    "md:opacity-100",
    "lg:opacity-100",
    "xl:opacity-100",
    "sm:pointer-events-auto",
    "md:pointer-events-auto",
    "lg:pointer-events-auto",
    "xl:pointer-events-auto",
    // Panel width utilities for different screen sizes
    "lg:w-[600px]",
    "xl:w-[800px]",
    "2xl:w-[1000px]",
    // Flex direction for responsive layouts
    "sm:flex-row",
    "md:flex-row",
    "lg:flex-row",
    "xl:flex-row",
    "sm:flex-col",
    "md:flex-col",
    "lg:flex-col",
    "xl:flex-col",
  ],
  prefix: "",
  theme: {
    // Explicit breakpoint definitions (matches Tailwind defaults for clarity)
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        md: "2rem",
        lg: "2rem",
        xl: "2rem",
        "2xl": "2rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      backgroundImage: {
        "diagonal-lines": `
          repeating-linear-gradient(-45deg, hsl(var(--border) / 0.4) 0 2px, transparent 1px 12px),
          linear-gradient(hsl(var(--background)), hsl(var(--background)))
        `,
      },
      ringColor: {
        DEFAULT: "hsl(var(--primary))", // e.g. Tailwind's blue-500
      },
      fontSize: {
        // These are downshifted by 1
        xs: ["0.625rem", { lineHeight: "0.875rem" }], // 10px / 14px
        sm: ["0.75rem", { lineHeight: "1rem" }], // 12px / 16px
        base: ["0.875rem", { lineHeight: "1.25rem" }], // 14px / 20px
        lg: ["1rem", { lineHeight: "1.5rem" }], // 16px / 24px
        xl: ["1.125rem", { lineHeight: "1.75rem" }], // 18px / 28px
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        neutral: {
          DEFAULT: "hsl(var(--neutral))",
          foreground: "hsl(var(--neutral-foreground))",
        },
        status: {
          init: "hsl(var(--status-init))",
          "init-foreground": "hsl(var(--status-init-foreground))",
          running: "hsl(var(--status-running))",
          "running-foreground": "hsl(var(--status-running-foreground))",
          complete: "hsl(var(--status-complete))",
          "complete-foreground": "hsl(var(--status-complete-foreground))",
          failed: "hsl(var(--status-failed))",
          "failed-foreground": "hsl(var(--status-failed-foreground))",
          paused: "hsl(var(--status-paused))",
          "paused-foreground": "hsl(var(--status-paused-foreground))",
        },
        console: {
          DEFAULT: "hsl(var(--console-background))",
          foreground: "hsl(var(--console-foreground))",
          success: "hsl(var(--console-success))",
          error: "hsl(var(--console-error))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        "chivo-mono": ["Chivo Mono", "Noto Emoji", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        pill: {
          "0%": { opacity: "0" },
          "10%": { opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        pill: "pill 2s ease-in-out forwards",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/container-queries"),
  ],
};
