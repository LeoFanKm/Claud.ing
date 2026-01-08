import { Github, Globe, Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ThemeMode } from "shared/types";
import { ClerkAuthButtons } from "@/components/auth/ClerkAuth";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import i18n from "@/i18n";

type NavLink = {
  label: string;
  href?: string;
  to?: string;
  external?: boolean;
};

const NAV_LINKS: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "Docs", to: "/docs" },
  {
    label: "GitHub",
    href: "https://github.com/anthropics/claude-code",
    external: true,
  },
];

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "zh-Hans", label: "简体中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

function LanguageSwitcher() {
  const currentLang = i18n.language;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-9 w-9" size="icon" variant="ghost">
          <Globe className="h-4 w-4" />
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            className={currentLang === lang.code ? "bg-accent" : ""}
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation("common");

  const themeIcon = {
    [ThemeMode.LIGHT]: <Sun className="h-4 w-4" />,
    [ThemeMode.DARK]: <Moon className="h-4 w-4" />,
    [ThemeMode.SYSTEM]: <Monitor className="h-4 w-4" />,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-9 w-9" size="icon" variant="ghost">
          {themeIcon[theme]}
          <span className="sr-only">{t("theme.toggle", "Toggle theme")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme(ThemeMode.LIGHT)}>
          <Sun className="mr-2 h-4 w-4" />
          {t("theme.light", "Light")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(ThemeMode.DARK)}>
          <Moon className="mr-2 h-4 w-4" />
          {t("theme.dark", "Dark")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(ThemeMode.SYSTEM)}>
          <Monitor className="mr-2 h-4 w-4" />
          {t("theme.system", "System")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LandingNavbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link className="flex items-center" to="/">
          <Logo size="md" />
        </Link>

        {/* Navigation Links */}
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) =>
            link.to ? (
              <Link
                className="font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
                key={link.label}
                to={link.to}
              >
                {link.label}
              </Link>
            ) : link.href?.startsWith("#") ? (
              <button
                className="cursor-pointer font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
                key={link.label}
                onClick={() => {
                  const el = document.getElementById(link.href!.slice(1));
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                type="button"
              >
                {link.label}
              </button>
            ) : (
              <a
                className="inline-flex items-center gap-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
                href={link.href}
                key={link.label}
                rel={link.external ? "noopener noreferrer" : undefined}
                target={link.external ? "_blank" : undefined}
              >
                {link.label === "GitHub" && <Github className="h-4 w-4" />}
                {link.label}
              </a>
            )
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <div className="h-6 w-px bg-border" />
          <ClerkAuthButtons />
        </div>
      </div>
    </nav>
  );
}
