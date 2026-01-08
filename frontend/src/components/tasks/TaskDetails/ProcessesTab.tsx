import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Cog,
  Play,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExecutionProcess, ExecutionProcessStatus } from "shared/types";
import { ProfileVariantBadge } from "@/components/common/ProfileVariantBadge.tsx";
import { useProcessSelection } from "@/contexts/ProcessSelectionContext";
import { useRetryUi } from "@/contexts/RetryUiContext";
import { useExecutionProcesses } from "@/hooks/useExecutionProcesses";
import { useLogStream } from "@/hooks/useLogStream";
import { executionProcessesApi } from "@/lib/api.ts";
import { ProcessLogsViewerContent } from "./ProcessLogsViewer";

interface ProcessesTabProps {
  attemptId?: string;
}

function ProcessesTab({ attemptId }: ProcessesTabProps) {
  const { t } = useTranslation("tasks");
  const {
    executionProcesses,
    executionProcessesById,
    isLoading: processesLoading,
    isConnected,
    error: processesError,
  } = useExecutionProcesses(attemptId ?? "", { showSoftDeleted: true });
  const { selectedProcessId, setSelectedProcessId } = useProcessSelection();
  const [loadingProcessId, setLoadingProcessId] = useState<string | null>(null);
  const [localProcessDetails, setLocalProcessDetails] = useState<
    Record<string, ExecutionProcess>
  >({});
  const [copied, setCopied] = useState(false);

  const selectedProcess = selectedProcessId
    ? localProcessDetails[selectedProcessId] ||
      executionProcessesById[selectedProcessId]
    : null;

  const { logs, error: logsError } = useLogStream(selectedProcess?.id ?? "");

  useEffect(() => {
    setLocalProcessDetails({});
    setLoadingProcessId(null);
  }, [attemptId]);

  const handleCopyLogs = useCallback(async () => {
    if (logs.length === 0) return;

    const text = logs.map((entry) => entry.content).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Copy to clipboard failed:", err);
    }
  }, [logs]);

  const getStatusIcon = (status: ExecutionProcessStatus) => {
    switch (status) {
      case "running":
        return <Play className="h-4 w-4 text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "killed":
        return <Square className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ExecutionProcessStatus) => {
    switch (status) {
      case "running":
        return "bg-blue-50 border-blue-200 text-blue-800";
      case "completed":
        return "bg-green-50 border-green-200 text-green-800";
      case "failed":
        return "bg-red-50 border-red-200 text-red-800";
      case "killed":
        return "bg-gray-50 border-gray-200 text-gray-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const fetchProcessDetails = useCallback(async (processId: string) => {
    try {
      setLoadingProcessId(processId);
      const result = await executionProcessesApi.getDetails(processId);

      if (result !== undefined) {
        setLocalProcessDetails((prev) => ({
          ...prev,
          [processId]: result,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch process details:", err);
    } finally {
      setLoadingProcessId((current) =>
        current === processId ? null : current
      );
    }
  }, []);

  // Automatically fetch process details when selectedProcessId changes
  useEffect(() => {
    if (!(attemptId && selectedProcessId)) {
      return;
    }

    if (
      !localProcessDetails[selectedProcessId] &&
      loadingProcessId !== selectedProcessId
    ) {
      fetchProcessDetails(selectedProcessId);
    }
  }, [
    attemptId,
    selectedProcessId,
    localProcessDetails,
    loadingProcessId,
    fetchProcessDetails,
  ]);

  const handleProcessClick = async (process: ExecutionProcess) => {
    setSelectedProcessId(process.id);

    // If we don't have details for this process, fetch them
    if (!localProcessDetails[process.id]) {
      await fetchProcessDetails(process.id);
    }
  };

  const { isProcessGreyed } = useRetryUi();

  if (!attemptId) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Cog className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>{t("processes.selectAttempt")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {selectedProcessId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
            <h2 className="font-semibold text-lg">
              {t("processes.detailsTitle")}
            </h2>
            <div className="flex items-center gap-2">
              <button
                className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 font-medium text-sm transition-colors ${
                  copied
                    ? "text-success"
                    : logs.length === 0
                      ? "cursor-not-allowed text-muted-foreground opacity-50"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
                disabled={logs.length === 0}
                onClick={handleCopyLogs}
              >
                {copied ? t("processes.logsCopied") : t("processes.copyLogs")}
              </button>
              <button
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted/50 hover:text-foreground"
                onClick={() => setSelectedProcessId(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                {t("processes.backToList")}
              </button>
            </div>
          </div>
          <div className="flex-1">
            {selectedProcess ? (
              <ProcessLogsViewerContent error={logsError} logs={logs} />
            ) : loadingProcessId === selectedProcessId ? (
              <div className="text-center text-muted-foreground">
                <p>{t("processes.loadingDetails")}</p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <p>{t("processes.errorLoadingDetails")}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-4 pt-4 pb-20">
          {processesError && (
            <div className="mb-3 text-destructive text-sm">
              {t("processes.errorLoadingUpdates")}
              {!isConnected && ` ${t("processes.reconnecting")}`}
            </div>
          )}
          {processesLoading && executionProcesses.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <p>{t("processes.loading")}</p>
            </div>
          ) : executionProcesses.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <div className="text-center">
                <Cog className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>{t("processes.noProcesses")}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {executionProcesses.map((process) => (
                <div
                  className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/30 ${
                    loadingProcessId === process.id
                      ? "cursor-wait opacity-50"
                      : isProcessGreyed(process.id)
                        ? "opacity-50"
                        : ""
                  }`}
                  key={process.id}
                  onClick={() => handleProcessClick(process)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex min-w-0 items-center space-x-3">
                      {getStatusIcon(process.status)}
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm">
                          {process.run_reason}
                        </h3>
                        <p
                          className="mt-1 truncate text-muted-foreground text-sm"
                          title={process.id}
                        >
                          {t("processes.processId", { id: process.id })}
                        </p>
                        {process.dropped && (
                          <span
                            className="mt-1 inline-block rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700"
                            title={t("processes.deletedTooltip")}
                          >
                            {t("processes.deleted")}
                          </span>
                        )}
                        {
                          <p className="mt-1 text-muted-foreground text-sm">
                            {t("processes.agent")}{" "}
                            {process.executor_action.typ.type ===
                              "CodingAgentInitialRequest" ||
                            process.executor_action.typ.type ===
                              "CodingAgentFollowUpRequest" ? (
                              <ProfileVariantBadge
                                profileVariant={
                                  process.executor_action.typ
                                    .executor_profile_id
                                }
                              />
                            ) : null}
                          </p>
                        }
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block rounded-full border px-2 py-1 font-medium text-xs ${getStatusColor(
                          process.status
                        )}`}
                      >
                        {process.status}
                      </span>
                      {process.exit_code !== null && (
                        <p className="mt-1 text-muted-foreground text-xs">
                          {t("processes.exit", {
                            code: process.exit_code.toString(),
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-muted-foreground text-xs">
                    <div className="flex justify-between">
                      <span>
                        {t("processes.started", {
                          date: formatDate(process.started_at),
                        })}
                      </span>
                      {process.completed_at && (
                        <span>
                          {t("processes.completed", {
                            date: formatDate(process.completed_at),
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProcessesTab;
