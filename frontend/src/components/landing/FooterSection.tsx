import { Github } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

const FOOTER_LINKS = [
  { labelKey: "footer.terms", to: "/terms" },
  { labelKey: "footer.privacy", to: "/privacy" },
];

export function FooterSection() {
  const { t } = useTranslation("landing");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          {/* Logo + Copyright */}
          <div className="flex flex-col items-center gap-3 md:items-start">
            <Logo size="sm" />
            <p className="text-muted-foreground text-sm">
              {t("footer.copyright", { year: currentYear })}
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <Link
                className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                key={link.labelKey}
                to={link.to}
              >
                {t(link.labelKey)}
              </Link>
            ))}
            <a
              className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
              href="https://github.com/anthropics/claude-code"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
