/**
 * @file useTaskSession.ts
 * @description WebSocket hook for real-time task session synchronization
 *
 * @input sessionId, userId, enabled flag
 * @output connection state, session state, presence info, mutation functions
 * @position frontend/src/hooks (React hooks layer)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { oauthApi } from "@/lib/api";
import { REMOTE_API_URL } from "@/lib/remoteApi";

// ============================================================================
// Types (mirrored from workers/src/durable-objects/task-session.ts)
// ============================================================================

export type MessageType =
  | "connect"
  | "disconnect"
  | "heartbeat"
  | "state_update"
  | "cursor_update"
  | "presence_update"
  | "error";

export interface BaseMessage {
  type: MessageType;
  timestamp: number;
}

export interface ConnectMessage extends BaseMessage {
  type: "connect";
  userId: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

export interface DisconnectMessage extends BaseMessage {
  type: "disconnect";
  userId: string;
  reason?: string;
}

export interface HeartbeatMessage extends BaseMessage {
  type: "heartbeat";
}

export interface StateUpdateMessage extends BaseMessage {
  type: "state_update";
  taskId: string;
  changes: Record<string, unknown>;
  userId: string;
}

export interface CursorUpdateMessage extends BaseMessage {
  type: "cursor_update";
  userId: string;
  position: { line: number; column: number };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface PresenceInfo {
  userId: string;
  sessionId: string;
  connectedAt: number;
  lastActivity: number;
  metadata?: Record<string, unknown>;
}

export interface PresenceUpdateMessage extends BaseMessage {
  type: "presence_update";
  users: PresenceInfo[];
}

export interface ErrorMessage extends BaseMessage {
  type: "error";
  code: string;
  message: string;
}

export type WebSocketMessage =
  | ConnectMessage
  | DisconnectMessage
  | HeartbeatMessage
  | StateUpdateMessage
  | CursorUpdateMessage
  | PresenceUpdateMessage
  | ErrorMessage;

// ============================================================================
// Connection State
// ============================================================================

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface TaskSessionState {
  status: ConnectionStatus;
  sessionState: Record<string, unknown>;
  presence: PresenceInfo[];
  error: string | null;
  lastConnectedAt: number | null;
  reconnectAttempts: number;
}

// ============================================================================
// Configuration
// ============================================================================

const HEARTBEAT_INTERVAL_MS = 25_000; // 25s (server expects 30s, send earlier)
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;

// ============================================================================
// Hook Options
// ============================================================================

export interface UseTaskSessionOptions {
  /** Called when connection is established */
  onConnect?: (message: ConnectMessage) => void;
  /** Called when another user joins/leaves */
  onPresenceUpdate?: (users: PresenceInfo[]) => void;
  /** Called when session state is updated */
  onStateUpdate?: (changes: Record<string, unknown>, userId: string) => void;
  /** Called when cursor position changes (for collaboration) */
  onCursorUpdate?: (message: CursorUpdateMessage) => void;
  /** Called on connection error */
  onError?: (error: ErrorMessage) => void;
  /** Called when disconnected */
  onDisconnect?: (reason?: string) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTaskSession(
  sessionId: string | undefined,
  userId: string | undefined,
  enabled = true,
  options: UseTaskSessionOptions = {}
) {
  const [state, setState] = useState<TaskSessionState>({
    status: "disconnected",
    sessionState: {},
    presence: [],
    error: null,
    lastConnectedAt: null,
    reconnectAttempts: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isCleaningUpRef = useRef(false);

  // Store options in ref to avoid re-renders
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /**
   * Calculate reconnect delay with exponential backoff
   */
  const getReconnectDelay = useCallback(() => {
    const attempt = reconnectAttemptsRef.current;
    const delay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      INITIAL_RECONNECT_DELAY_MS * 2 ** attempt
    );
    // Add jitter (±20%) to prevent thundering herd
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }, []);

  /**
   * Clear heartbeat interval
   */
  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * Clear reconnect timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Start heartbeat interval
   */
  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    heartbeatIntervalRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const heartbeat: HeartbeatMessage = {
          type: "heartbeat",
          timestamp: Date.now(),
        };
        wsRef.current.send(JSON.stringify(heartbeat));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [clearHeartbeat]);

  /**
   * Handle incoming WebSocket message
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case "connect":
          setState((prev) => ({
            ...prev,
            status: "connected",
            lastConnectedAt: Date.now(),
            reconnectAttempts: 0,
            error: null,
          }));
          reconnectAttemptsRef.current = 0;
          optionsRef.current.onConnect?.(message);
          break;

        case "disconnect":
          optionsRef.current.onDisconnect?.(message.reason);
          break;

        case "heartbeat":
          // Server acknowledged heartbeat, no action needed
          break;

        case "state_update":
          setState((prev) => ({
            ...prev,
            sessionState: {
              ...prev.sessionState,
              ...message.changes,
            },
          }));
          optionsRef.current.onStateUpdate?.(message.changes, message.userId);
          break;

        case "cursor_update":
          optionsRef.current.onCursorUpdate?.(message);
          break;

        case "presence_update":
          setState((prev) => ({
            ...prev,
            presence: message.users,
          }));
          optionsRef.current.onPresenceUpdate?.(message.users);
          break;

        case "error":
          setState((prev) => ({
            ...prev,
            error: message.message,
          }));
          optionsRef.current.onError?.(message);
          break;
      }
    } catch (err) {
      console.error("[useTaskSession] Failed to parse message:", err);
    }
  }, []);

  /**
   * Schedule reconnection with exponential backoff
   */
  const scheduleReconnect = useCallback(() => {
    if (isCleaningUpRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Max reconnection attempts reached",
      }));
      return;
    }

    const delay = getReconnectDelay();
    reconnectAttemptsRef.current += 1;

    setState((prev) => ({
      ...prev,
      status: "reconnecting",
      reconnectAttempts: reconnectAttemptsRef.current,
    }));

    reconnectTimeoutRef.current = window.setTimeout(() => {
      reconnectTimeoutRef.current = null;
      // Trigger reconnect by updating state (useEffect will handle)
      setState((prev) => ({ ...prev }));
    }, delay);
  }, [getReconnectDelay]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async () => {
    if (!(sessionId && userId && enabled)) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    isCleaningUpRef.current = false;

    setState((prev) => ({
      ...prev,
      status: "connecting",
      error: null,
    }));

    try {
      // Get auth token for authenticated WebSocket
      const tokenRes = await oauthApi.getToken();
      if (!tokenRes?.access_token) {
        throw new Error("Not authenticated");
      }

      // Build WebSocket URL
      const baseUrl = REMOTE_API_URL || window.location.origin;
      const wsUrl = baseUrl.replace(/^http/, "ws");
      const url = new URL(`${wsUrl}/api/ws/sessions/${sessionId}`);
      url.searchParams.set("userId", userId);
      url.searchParams.set("token", tokenRes.access_token);

      const ws = new WebSocket(url.toString());

      ws.onopen = () => {
        startHeartbeat();
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error("[useTaskSession] WebSocket error:", event);
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Connection error",
        }));
      };

      ws.onclose = (event) => {
        clearHeartbeat();
        wsRef.current = null;

        // Don't reconnect if we're cleaning up or it was a clean close
        if (isCleaningUpRef.current || event.code === 1000) {
          setState((prev) => ({
            ...prev,
            status: "disconnected",
          }));
          return;
        }

        // Schedule reconnection for unexpected closures
        scheduleReconnect();
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[useTaskSession] Connection failed:", err);
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Connection failed",
      }));
      scheduleReconnect();
    }
  }, [
    sessionId,
    userId,
    enabled,
    startHeartbeat,
    handleMessage,
    clearHeartbeat,
    scheduleReconnect,
  ]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    isCleaningUpRef.current = true;
    clearHeartbeat();
    clearReconnectTimeout();
    reconnectAttemptsRef.current = 0;

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close(1000, "User disconnect");
      wsRef.current = null;
    }

    setState({
      status: "disconnected",
      sessionState: {},
      presence: [],
      error: null,
      lastConnectedAt: null,
      reconnectAttempts: 0,
    });
  }, [clearHeartbeat, clearReconnectTimeout]);

  /**
   * Send state update to all connected clients
   */
  const updateState = useCallback(
    (changes: Record<string, unknown>) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn("[useTaskSession] Cannot send: not connected");
        return false;
      }

      if (!(sessionId && userId)) return false;

      const message: StateUpdateMessage = {
        type: "state_update",
        taskId: sessionId,
        changes,
        userId,
        timestamp: Date.now(),
      };

      wsRef.current.send(JSON.stringify(message));
      return true;
    },
    [sessionId, userId]
  );

  /**
   * Send cursor position update (for collaboration)
   */
  const updateCursor = useCallback(
    (
      position: { line: number; column: number },
      selection?: {
        start: { line: number; column: number };
        end: { line: number; column: number };
      }
    ) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return false;
      }

      if (!userId) return false;

      const message: CursorUpdateMessage = {
        type: "cursor_update",
        userId,
        position,
        selection,
        timestamp: Date.now(),
      };

      wsRef.current.send(JSON.stringify(message));
      return true;
    },
    [userId]
  );

  /**
   * Force reconnect
   */
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    // Small delay before reconnecting
    setTimeout(() => {
      connect();
    }, 100);
  }, [disconnect, connect]);

  // Effect: Connect/disconnect based on enabled state and params
  useEffect(() => {
    if (enabled && sessionId && userId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, sessionId, userId, connect, disconnect]);

  return {
    // State
    status: state.status,
    isConnected: state.status === "connected",
    isConnecting:
      state.status === "connecting" || state.status === "reconnecting",
    sessionState: state.sessionState,
    presence: state.presence,
    error: state.error,
    reconnectAttempts: state.reconnectAttempts,
    lastConnectedAt: state.lastConnectedAt,

    // Actions
    updateState,
    updateCursor,
    disconnect,
    reconnect,
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export type UseTaskSessionReturn = ReturnType<typeof useTaskSession>;
