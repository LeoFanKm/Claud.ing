import { AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { PatchType } from "shared/types";
import RawLogText from "@/components/common/RawLogText";
import { useLogStream } from "@/hooks/useLogStream";

type LogEntry = Extract<PatchType, { type: "STDOUT" } | { type: "STDERR" }>;

interface ProcessLogsViewerProps {
  processId: string;
}

export function ProcessLogsViewerContent({
  logs,
  error,
}: {
  logs: LogEntry[];
  error: string | null;
}) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const didInitScroll = useRef(false);
  const prevLenRef = useRef(0);
  const [atBottom, setAtBottom] = useState(true);

  // 1) Initial jump to bottom once data appears.
  useEffect(() => {
    if (!didInitScroll.current && logs.length > 0) {
      didInitScroll.current = true;
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: logs.length - 1,
          align: "end",
        });
      });
    }
  }, [logs.length]);

  // 2) If there's a large append and we're at bottom, force-stick to the last item.
  useEffect(() => {
    const prev = prevLenRef.current;
    const grewBy = logs.length - prev;
    prevLenRef.current = logs.length;

    // tweak threshold as you like; this handles "big bursts"
    const LARGE_BURST = 10;
    if (grewBy >= LARGE_BURST && atBottom && logs.length > 0) {
      // defer so Virtuoso can re-measure before jumping
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: logs.length - 1,
          align: "end",
        });
      });
    }
  }, [logs.length, atBottom, logs]);

  const formatLogLine = (entry: LogEntry, index: number) => {
    return (
      <RawLogText
        channel={entry.type === "STDERR" ? "stderr" : "stdout"}
        className="px-4 py-1 text-sm"
        content={entry.content}
        key={index}
      />
    );
  };

  return (
    <div className="h-full">
      {logs.length === 0 && !error ? (
        <div className="p-4 text-center text-muted-foreground text-sm">
          No logs available
        </div>
      ) : error ? (
        <div className="p-4 text-center text-destructive text-sm">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      ) : (
        <Virtuoso<LogEntry>
          atBottomStateChange={setAtBottom}
          className="flex-1 rounded-lg"
          data={logs}
          followOutput={atBottom ? "smooth" : false}
          // Keep pinned while user is at bottom; release when they scroll up
          increaseViewportBy={{ top: 0, bottom: 600 }}
          itemContent={(index, entry) =>
            formatLogLine(entry as LogEntry, index)
          }
          // Optional: a bit more overscan helps during bursts
          ref={virtuosoRef}
        />
      )}
    </div>
  );
}

export default function ProcessLogsViewer({
  processId,
}: ProcessLogsViewerProps) {
  const { logs, error } = useLogStream(processId);
  return <ProcessLogsViewerContent error={error} logs={logs} />;
}
