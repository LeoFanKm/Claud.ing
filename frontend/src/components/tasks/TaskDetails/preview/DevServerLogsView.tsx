import { ChevronDown, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ExecutionProcess } from "shared/types";
import ProcessLogsViewer, {
  ProcessLogsViewerContent,
} from "../ProcessLogsViewer";

interface DevServerLogsViewProps {
  latestDevServerProcess: ExecutionProcess | undefined;
  showLogs: boolean;
  onToggle: () => void;
  height?: string;
  showToggleText?: boolean;
  logs?: Array<{ type: "STDOUT" | "STDERR"; content: string }>;
  error?: string | null;
}

export function DevServerLogsView({
  latestDevServerProcess,
  showLogs,
  onToggle,
  height = "h-60",
  showToggleText = true,
  logs,
  error,
}: DevServerLogsViewProps) {
  const { t } = useTranslation("tasks");

  if (!latestDevServerProcess) {
    return null;
  }

  return (
    <details
      className="group border-t bg-background"
      onToggle={(e) => {
        if (e.currentTarget.open !== showLogs) {
          onToggle();
        }
      }}
      open={showLogs}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground text-sm">
              {t("preview.logs.title")}
            </span>
          </div>
          <div className="flex items-center text-sm">
            <ChevronDown
              className={`mr-1 h-4 w-4 ${showToggleText ? "transition-transform" : ""} ${showLogs ? "" : "rotate-180"}`}
            />
            {showToggleText
              ? showLogs
                ? t("preview.logs.hide")
                : t("preview.logs.show")
              : t("preview.logs.hide")}
          </div>
        </div>
      </summary>

      {showLogs && (
        <div className={height}>
          {logs ? (
            <ProcessLogsViewerContent error={error ?? null} logs={logs} />
          ) : (
            <ProcessLogsViewer processId={latestDevServerProcess.id} />
          )}
        </div>
      )}
    </details>
  );
}
