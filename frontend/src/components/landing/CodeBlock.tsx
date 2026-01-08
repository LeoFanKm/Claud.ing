import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  onCopy?: () => void;
  copied?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  onCopy,
  copied = false,
  className,
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3 font-mono text-sm",
        "border border-border/50",
        className
      )}
    >
      <span className="select-none text-muted-foreground">$</span>
      <code className="flex-1 text-foreground">{code}</code>
      {onCopy && (
        <button
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
          onClick={onCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}
