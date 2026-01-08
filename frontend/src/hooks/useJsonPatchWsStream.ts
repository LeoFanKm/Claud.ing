import { useCallback, useEffect, useRef, useState } from "react";
import type { Operation } from "rfc6902";
import { applyPatch } from "rfc6902";
import {
  type ConnectionConfig,
  type ConnectionState,
  calculateReconnectDelay,
  createInitialConnectionState,
  DEFAULT_CONNECTION_CONFIG,
} from "@/types/connection";

type WsJsonPatchMsg = { JsonPatch: Operation[] };
type WsFinishedMsg = { finished: boolean };
type WsMsg = WsJsonPatchMsg | WsFinishedMsg;

interface UseJsonPatchStreamOptions<T> {
  /**
   * Called once when the stream starts to inject initial data
   */
  injectInitialEntry?: (data: T) => void;
  /**
   * Filter/deduplicate patches before applying them
   */
  deduplicatePatches?: (patches: Operation[]) => Operation[];
  /**
   * Connection configuration (reconnect strategy)
   */
  connectionConfig?: Partial<ConnectionConfig>;
}

interface UseJsonPatchStreamResult<T> {
  data: T | undefined;
  connection: ConnectionState;
  /** @deprecated Use connection.status === 'connected' instead */
  isConnected: boolean;
  error: string | null;
  /** Countdown in seconds until next reconnect attempt (null if not reconnecting) */
  reconnectCountdown: number | null;
  /** Manually trigger a reconnect attempt */
  reconnect: () => void;
}

/**
 * Generic hook for consuming WebSocket streams that send JSON messages with patches
 */
export const useJsonPatchWsStream = <T extends object>(
  endpoint: string | undefined,
  enabled: boolean,
  initialData: () => T,
  options?: UseJsonPatchStreamOptions<T>
): UseJsonPatchStreamResult<T> => {
  const [data, setData] = useState<T | undefined>(undefined);
  const [connection, setConnection] = useState<ConnectionState>(
    createInitialConnectionState
  );
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(
    null
  );
  const wsRef = useRef<WebSocket | null>(null);
  const dataRef = useRef<T | undefined>(undefined);
  const retryTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const finishedRef = useRef<boolean>(false);

  const injectInitialEntry = options?.injectInitialEntry;
  const deduplicatePatches = options?.deduplicatePatches;
  const config: ConnectionConfig = {
    ...DEFAULT_CONNECTION_CONFIG,
    ...options?.connectionConfig,
  };

  // Clear countdown timer
  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setReconnectCountdown(null);
  }, []);

  // Schedule reconnect with countdown
  const scheduleReconnect = useCallback(() => {
    if (retryTimerRef.current) return; // already scheduled

    const attempt = connection.reconnectAttempts;

    // Check if max attempts reached
    if (attempt >= config.maxReconnectAttempts) {
      setConnection((prev) => ({
        ...prev,
        status: "error",
        error: `Max reconnect attempts (${config.maxReconnectAttempts}) reached`,
      }));
      return;
    }

    // Calculate delay using the utility function
    const delay = calculateReconnectDelay(attempt, config);
    const delaySeconds = Math.ceil(delay / 1000);

    // Set initial countdown
    setReconnectCountdown(delaySeconds);

    // Start countdown interval
    let remaining = delaySeconds;
    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdownTimer();
      } else {
        setReconnectCountdown(remaining);
      }
    }, 1000);

    // Schedule the actual reconnect
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      clearCountdownTimer();
      setRetryNonce((n) => n + 1);
    }, delay);
  }, [connection.reconnectAttempts, config, clearCountdownTimer]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    // Clear any existing timers
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    clearCountdownTimer();

    // Reset attempt count and trigger reconnect
    setConnection((prev) => ({
      ...prev,
      status: "connecting",
      reconnectAttempts: 0,
      error: null,
    }));
    setRetryNonce((n) => n + 1);
  }, [clearCountdownTimer]);

  useEffect(() => {
    if (!(enabled && endpoint)) {
      // Close connection and reset state
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      clearCountdownTimer();
      finishedRef.current = false;
      setData(undefined);
      setConnection(createInitialConnectionState());
      dataRef.current = undefined;
      return;
    }

    // Initialize data
    if (!dataRef.current) {
      dataRef.current = initialData();

      // Inject initial entry if provided
      if (injectInitialEntry) {
        injectInitialEntry(dataRef.current);
      }
    }

    // Create WebSocket if it doesn't exist
    if (!wsRef.current) {
      // Reset finished flag for new connection
      finishedRef.current = false;

      // Set connecting status
      setConnection((prev) => ({
        ...prev,
        status: "connecting",
        error: null,
      }));

      // Convert HTTP endpoint to WebSocket endpoint
      const wsEndpoint = endpoint.replace(/^http/, "ws");
      const ws = new WebSocket(wsEndpoint);

      ws.onopen = () => {
        setConnection({
          status: "connected",
          error: null,
          lastConnectedAt: Date.now(),
          reconnectAttempts: 0,
        });
        clearCountdownTimer();
        if (retryTimerRef.current) {
          window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMsg = JSON.parse(event.data);

          // Handle JsonPatch messages (same as SSE json_patch event)
          if ("JsonPatch" in msg) {
            const patches: Operation[] = msg.JsonPatch;
            const filtered = deduplicatePatches
              ? deduplicatePatches(patches)
              : patches;

            const current = dataRef.current;
            if (!(filtered.length && current)) return;

            // Deep clone the current state before mutating it
            const next = structuredClone(current);

            // Apply patch (mutates the clone in place)
            applyPatch(next, filtered);

            dataRef.current = next;
            setData(next);
          }

          // Handle finished messages ({finished: true})
          // Treat finished as terminal - do NOT reconnect
          if ("finished" in msg) {
            finishedRef.current = true;
            ws.close(1000, "finished");
            wsRef.current = null;
            setConnection((prev) => ({
              ...prev,
              status: "disconnected",
            }));
          }
        } catch (err) {
          console.error("Failed to process WebSocket message:", err);
          setConnection((prev) => ({
            ...prev,
            error: "Failed to process stream update",
          }));
        }
      };

      ws.onerror = () => {
        setConnection((prev) => ({
          ...prev,
          error: "Connection failed",
        }));
      };

      ws.onclose = (evt) => {
        wsRef.current = null;

        // Do not reconnect if we received a finished message or clean close
        if (finishedRef.current || (evt?.code === 1000 && evt?.wasClean)) {
          setConnection((prev) => ({
            ...prev,
            status: "disconnected",
          }));
          return;
        }

        // Otherwise, reconnect on unexpected/error closures
        setConnection((prev) => ({
          ...prev,
          status: "reconnecting",
          reconnectAttempts: prev.reconnectAttempts + 1,
        }));
        scheduleReconnect();
      };

      wsRef.current = ws;
    }

    return () => {
      if (wsRef.current) {
        const ws = wsRef.current;

        // Clear all event handlers first to prevent callbacks after cleanup
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;

        // Close regardless of state
        ws.close();
        wsRef.current = null;
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      clearCountdownTimer();
      finishedRef.current = false;
      dataRef.current = undefined;
      setData(undefined);
    };
  }, [
    endpoint,
    enabled,
    initialData,
    injectInitialEntry,
    deduplicatePatches,
    retryNonce,
    clearCountdownTimer,
    scheduleReconnect,
  ]);

  // Derive isConnected for backward compatibility
  const isConnected = connection.status === "connected";
  const error = connection.error;

  return {
    data,
    connection,
    isConnected,
    error,
    reconnectCountdown,
    reconnect,
  };
};
