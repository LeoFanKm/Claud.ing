/**
 * [INPUT]: None (standalone type definitions)
 * [OUTPUT]: ConnectionStatus, ConnectionState, ConnectionConfig
 * [POS]: types/ 的 WebSocket 连接状态 SSOT，被所有 WS hooks 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// ============================================================================
// Connection Status (state machine states)
// ============================================================================

/**
 * WebSocket 连接状态枚举
 *
 * State transitions:
 *   disconnected -> connecting -> connected
 *                -> error
 *   connected    -> disconnected (clean close)
 *                -> reconnecting (unexpected close)
 *   reconnecting -> connecting -> connected
 *                -> error (max attempts)
 *   error        -> connecting (manual retry)
 */
export type ConnectionStatus =
  | "disconnected" // 初始状态或主动断开
  | "connecting" // 正在建立连接
  | "connected" // 已连接，正常通信
  | "reconnecting" // 意外断开，自动重连中
  | "error"; // 连接失败或达到最大重试次数

// ============================================================================
// Connection State
// ============================================================================

/**
 * 完整的 WebSocket 连接状态
 */
export interface ConnectionState {
  /** 当前连接状态 */
  status: ConnectionStatus;

  /** 错误信息 (status === 'error' 时有值) */
  error: string | null;

  /** 上次成功连接时间戳 */
  lastConnectedAt: number | null;

  /** 当前重连尝试次数 */
  reconnectAttempts: number;
}

// ============================================================================
// Connection Config
// ============================================================================

/**
 * WebSocket 连接配置 (重连策略)
 */
export interface ConnectionConfig {
  /** 心跳间隔 (ms) */
  heartbeatIntervalMs: number;

  /** 最大重连次数 */
  maxReconnectAttempts: number;

  /** 初始重连延迟 (ms) */
  initialReconnectDelayMs: number;

  /** 最大重连延迟 (ms) */
  maxReconnectDelayMs: number;
}

// ============================================================================
// Default Config
// ============================================================================

/**
 * 默认连接配置
 */
export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  heartbeatIntervalMs: 25_000, // 25s (server expects 30s)
  maxReconnectAttempts: 10,
  initialReconnectDelayMs: 1000,
  maxReconnectDelayMs: 30_000,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 创建初始连接状态
 */
export function createInitialConnectionState(): ConnectionState {
  return {
    status: "disconnected",
    error: null,
    lastConnectedAt: null,
    reconnectAttempts: 0,
  };
}

/**
 * 计算重连延迟 (指数退避 + 抖动)
 */
export function calculateReconnectDelay(
  attempt: number,
  config: ConnectionConfig = DEFAULT_CONNECTION_CONFIG
): number {
  const { initialReconnectDelayMs, maxReconnectDelayMs } = config;
  const delay = Math.min(
    maxReconnectDelayMs,
    initialReconnectDelayMs * 2 ** attempt
  );
  // 添加 ±20% 抖动，防止惊群效应
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * 检查是否应该尝试重连
 */
export function shouldAttemptReconnect(
  state: ConnectionState,
  config: ConnectionConfig = DEFAULT_CONNECTION_CONFIG
): boolean {
  return (
    state.status !== "connected" &&
    state.status !== "connecting" &&
    state.reconnectAttempts < config.maxReconnectAttempts
  );
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 检查是否已连接
 */
export function isConnected(status: ConnectionStatus): boolean {
  return status === "connected";
}

/**
 * 检查是否正在连接/重连
 */
export function isConnecting(status: ConnectionStatus): boolean {
  return status === "connecting" || status === "reconnecting";
}

/**
 * 检查是否处于断开状态
 */
export function isDisconnected(status: ConnectionStatus): boolean {
  return status === "disconnected" || status === "error";
}
