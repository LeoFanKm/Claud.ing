import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeBlock } from "./CodeBlock";

const INSTALL_COMMAND = "npx @anthropic-ai/claude-code";

export function QuickStartSection() {
  const { t } = useTranslation("landing");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = INSTALL_COMMAND;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-bold text-2xl text-foreground tracking-tight sm:text-3xl">
          {t("quickStart.title")}
        </h2>
        <p className="mt-3 text-muted-foreground text-sm">
          {t("quickStart.requirement")}
        </p>
        <div className="mt-8 flex justify-center">
          <CodeBlock
            className="w-full max-w-md"
            code={INSTALL_COMMAND}
            copied={copied}
            onCopy={handleCopy}
          />
        </div>
      </div>
    </section>
  );
}
