import { Copy, ExternalLink, Loader2, Pause, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { NewCardHeader } from "@/components/ui/new-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PreviewToolbarProps {
  mode: "noServer" | "error" | "ready";
  url?: string;
  onRefresh: () => void;
  onCopyUrl: () => void;
  onStop: () => void;
  isStopping?: boolean;
}

export function PreviewToolbar({
  mode,
  url,
  onRefresh,
  onCopyUrl,
  onStop,
  isStopping,
}: PreviewToolbarProps) {
  const { t } = useTranslation("tasks");

  const actions =
    mode !== "noServer" ? (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("preview.toolbar.refresh")}
                onClick={onRefresh}
                variant="icon"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("preview.toolbar.refresh")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("preview.toolbar.copyUrl")}
                disabled={!url}
                onClick={onCopyUrl}
                variant="icon"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("preview.toolbar.copyUrl")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("preview.toolbar.openInTab")}
                asChild
                disabled={!url}
                variant="icon"
              >
                <a
                  className="flex items-center"
                  href={url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("preview.toolbar.openInTab")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="h-4 w-px bg-border" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("preview.toolbar.stopDevServer")}
                disabled={isStopping}
                onClick={onStop}
                variant="icon"
              >
                {isStopping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("preview.toolbar.stopDevServer")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </>
    ) : undefined;

  return (
    <NewCardHeader actions={actions} className="shrink-0">
      <div className="flex items-center">
        <span
          aria-live="polite"
          className="truncate whitespace-nowrap font-mono text-muted-foreground text-sm"
        >
          {url || <Loader2 className="h-4 w-4 animate-spin" />}
        </span>
      </div>
    </NewCardHeader>
  );
}
