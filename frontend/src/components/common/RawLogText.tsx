import { clsx } from "clsx";
import { hasAnsi } from "fancy-ansi";
import { AnsiHtml } from "fancy-ansi/react";
import { memo } from "react";

interface RawLogTextProps {
  content: string;
  channel?: "stdout" | "stderr";
  as?: "div" | "span";
  className?: string;
  linkifyUrls?: boolean;
}

const RawLogText = memo(
  ({
    content,
    channel = "stdout",
    as: Component = "div",
    className,
    linkifyUrls = false,
  }: RawLogTextProps) => {
    // Only apply stderr fallback color when no ANSI codes are present
    const hasAnsiCodes = hasAnsi(content);
    const shouldApplyStderrFallback = channel === "stderr" && !hasAnsiCodes;

    const renderContent = () => {
      if (!linkifyUrls) {
        return <AnsiHtml text={content} />;
      }

      const urlRegex = /(https?:\/\/\S+)/g;
      const parts = content.split(urlRegex);

      return parts.map((part, index) => {
        if (/^https?:\/\/\S+$/.test(part)) {
          return (
            <a
              className="cursor-pointer text-info underline hover:text-info/80"
              href={part}
              key={index}
              onClick={(e) => e.stopPropagation()}
              rel="noopener noreferrer"
              target="_blank"
            >
              {part}
            </a>
          );
        }
        // For non-URL parts, apply ANSI formatting
        return <AnsiHtml key={index} text={part} />;
      });
    };

    return (
      <Component
        className={clsx(
          "whitespace-pre-wrap break-all font-mono text-xs",
          shouldApplyStderrFallback && "text-destructive",
          className
        )}
      >
        {renderContent()}
      </Component>
    );
  }
);

RawLogText.displayName = "RawLogText";

export default RawLogText;
