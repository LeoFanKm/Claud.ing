/**
 * @file task-session.ts
 * @description TaskSession Durable Object - 任务会话实时同步
 *
 * @input WebSocket 连接请求, 状态更新消息
 * @output 实时状态广播
 * @position workers/src/durable-objects (Durable Objects 层)
 */

import type { Bindings } from "../index";

// WebSocket 消息类型
export type MessageType =
  | "connect"
  | "disconnect"
  | "heartbeat"
  | "state_update"
  | "cursor_update"
  | "presence_update"
  | "error";

// 基础消息结构
export interface BaseMessage {
  type: MessageType;
  timestamp: number;
}

// 连接消息
export interface ConnectMessage extends BaseMessage {
  type: "connect";
  userId: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

// 断开连接消息
export interface DisconnectMessage extends BaseMessage {
  type: "disconnect";
  userId: string;
  reason?: string;
}

// 心跳消息
export interface HeartbeatMessage extends BaseMessage {
  type: "heartbeat";
}

// 状态更新消息
export interface StateUpdateMessage extends BaseMessage {
  type: "state_update";
  taskId: string;
  changes: Record<string, unknown>;
  userId: string;
}

// 光标更新消息 (用于协作编辑)
export interface CursorUpdateMessage extends BaseMessage {
  type: "cursor_update";
  userId: string;
  position: { line: number; column: number };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

// 在线状态消息
export interface PresenceUpdateMessage extends BaseMessage {
  type: "presence_update";
  users: PresenceInfo[];
}

// 错误消息
export interface ErrorMessage extends BaseMessage {
  type: "error";
  code: string;
  message: string;
}

// 消息联合类型
export type WebSocketMessage =
  | ConnectMessage
  | DisconnectMessage
  | HeartbeatMessage
  | StateUpdateMessage
  | CursorUpdateMessage
  | PresenceUpdateMessage
  | ErrorMessage;

// 用户在线状态信息
export interface PresenceInfo {
  userId: string;
  sessionId: string;
  connectedAt: number;
  lastActivity: number;
  metadata?: Record<string, unknown>;
}

// 连接信息
interface ConnectionInfo {
  userId: string;
  sessionId: string;
  connectedAt: number;
  lastHeartbeat: number;
  metadata?: Record<string, unknown>;
}

// 配置常量
const HEARTBEAT_INTERVAL_MS = 30_000; // 30 秒心跳间隔
const CONNECTION_TIMEOUT_MS = 90_000; // 90 秒无心跳断开
const MAX_CONNECTIONS_PER_SESSION = 100; // 每个会话最大连接数

/**
 * TaskSession Durable Object
 * 管理单个任务的实时 WebSocket 连接和状态同步
 */
export class TaskSession implements DurableObject {
  // WebSocket 连接映射: WebSocket -> ConnectionInfo
  private connections: Map<WebSocket, ConnectionInfo> = new Map();

  // 任务状态缓存
  private taskState: Record<string, unknown> = {};

  // 心跳检测定时器
  private heartbeatAlarm: number | null = null;

  constructor(
    private state: DurableObjectState,
    private env: Bindings
  ) {
    // 恢复持久化的任务状态
    this.state.blockConcurrencyWhile(async () => {
      const storedState =
        await this.state.storage.get<Record<string, unknown>>("taskState");
      if (storedState) {
        this.taskState = storedState;
      }
    });
  }

  /**
   * 处理传入请求
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket 升级请求
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    // REST API 端点
    switch (path) {
      case "/state":
        return this.handleGetState();
      case "/update":
        if (request.method === "POST") {
          return this.handleStateUpdate(request);
        }
        break;
      case "/presence":
        return this.handleGetPresence();
      case "/broadcast":
        if (request.method === "POST") {
          return this.handleBroadcast(request);
        }
        break;
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * 处理 WebSocket 升级请求
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    // 检查连接数限制
    if (this.connections.size >= MAX_CONNECTIONS_PER_SESSION) {
      return new Response("Too many connections", { status: 503 });
    }

    // 从 URL 参数获取用户信息
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const sessionId = url.searchParams.get("sessionId");

    if (!(userId && sessionId)) {
      return new Response("Missing userId or sessionId", { status: 400 });
    }

    // 创建 WebSocket 对
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // 接受 WebSocket 连接
    this.state.acceptWebSocket(server);

    // 记录连接信息
    const connectionInfo: ConnectionInfo = {
      userId,
      sessionId,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      metadata: Object.fromEntries(url.searchParams.entries()),
    };
    this.connections.set(server, connectionInfo);

    // 发送连接确认
    const connectMessage: ConnectMessage = {
      type: "connect",
      userId,
      sessionId,
      timestamp: Date.now(),
    };
    server.send(JSON.stringify(connectMessage));

    // 发送当前状态
    if (Object.keys(this.taskState).length > 0) {
      const stateMessage: StateUpdateMessage = {
        type: "state_update",
        taskId: sessionId,
        changes: this.taskState,
        userId: "system",
        timestamp: Date.now(),
      };
      server.send(JSON.stringify(stateMessage));
    }

    // 广播在线用户更新
    await this.broadcastPresence();

    // 设置心跳检测定时器
    await this.scheduleHeartbeatCheck();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * 处理 WebSocket 消息 (Cloudflare Durable Objects WebSocket API)
   */
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      ws.close(1008, "Connection not found");
      return;
    }

    try {
      const data =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      const parsed = JSON.parse(data) as WebSocketMessage;

      // 更新最后活动时间
      connectionInfo.lastHeartbeat = Date.now();

      switch (parsed.type) {
        case "heartbeat":
          // 响应心跳
          ws.send(
            JSON.stringify({
              type: "heartbeat",
              timestamp: Date.now(),
            })
          );
          break;

        case "state_update":
          await this.handleIncomingStateUpdate(
            ws,
            parsed as StateUpdateMessage
          );
          break;

        case "cursor_update":
          await this.broadcastToOthers(ws, parsed);
          break;

        default:
          console.log("Unknown message type:", parsed.type);
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
      const errorMessage: ErrorMessage = {
        type: "error",
        code: "PARSE_ERROR",
        message: "Failed to parse message",
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(errorMessage));
    }
  }

  /**
   * 处理 WebSocket 关闭
   */
  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ): Promise<void> {
    const connectionInfo = this.connections.get(ws);
    if (connectionInfo) {
      // 广播断开消息
      const disconnectMessage: DisconnectMessage = {
        type: "disconnect",
        userId: connectionInfo.userId,
        reason: reason || "Connection closed",
        timestamp: Date.now(),
      };
      await this.broadcastToOthers(ws, disconnectMessage);
    }

    this.connections.delete(ws);
    await this.broadcastPresence();
  }

  /**
   * 处理 WebSocket 错误
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error);
    const connectionInfo = this.connections.get(ws);
    if (connectionInfo) {
      const disconnectMessage: DisconnectMessage = {
        type: "disconnect",
        userId: connectionInfo.userId,
        reason: "Connection error",
        timestamp: Date.now(),
      };
      await this.broadcastToOthers(ws, disconnectMessage);
    }
    this.connections.delete(ws);
  }

  /**
   * 定时器触发 (用于心跳检测)
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    const deadConnections: WebSocket[] = [];

    // 检查所有连接的心跳
    for (const [ws, info] of this.connections.entries()) {
      if (now - info.lastHeartbeat > CONNECTION_TIMEOUT_MS) {
        deadConnections.push(ws);
      }
    }

    // 关闭死连接
    for (const ws of deadConnections) {
      const info = this.connections.get(ws);
      if (info) {
        const disconnectMessage: DisconnectMessage = {
          type: "disconnect",
          userId: info.userId,
          reason: "Connection timeout",
          timestamp: Date.now(),
        };
        await this.broadcastToOthers(ws, disconnectMessage);
      }
      try {
        ws.close(1000, "Connection timeout");
      } catch {
        // 忽略关闭错误
      }
      this.connections.delete(ws);
    }

    // 如果还有活跃连接，继续调度心跳检测
    if (this.connections.size > 0) {
      await this.scheduleHeartbeatCheck();
      await this.broadcastPresence();
    }
  }

  /**
   * 调度心跳检测
   */
  private async scheduleHeartbeatCheck(): Promise<void> {
    const nextCheck = Date.now() + HEARTBEAT_INTERVAL_MS;
    await this.state.storage.setAlarm(nextCheck);
  }

  /**
   * 处理传入的状态更新
   */
  private async handleIncomingStateUpdate(
    ws: WebSocket,
    message: StateUpdateMessage
  ): Promise<void> {
    // 合并状态更新
    this.taskState = {
      ...this.taskState,
      ...message.changes,
      lastUpdatedBy: message.userId,
      lastUpdatedAt: Date.now(),
    };

    // 持久化状态
    await this.state.storage.put("taskState", this.taskState);

    // 广播给所有其他客户端
    await this.broadcastToOthers(ws, {
      ...message,
      timestamp: Date.now(),
    });
  }

  /**
   * 广播消息给所有其他客户端
   */
  private async broadcastToOthers(
    sender: WebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    const messageStr = JSON.stringify(message);
    for (const [ws] of this.connections.entries()) {
      if (ws !== sender) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error("Failed to send message:", error);
        }
      }
    }
  }

  /**
   * 广播消息给所有客户端
   */
  private async broadcastToAll(message: WebSocketMessage): Promise<void> {
    const messageStr = JSON.stringify(message);
    for (const [ws] of this.connections.entries()) {
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    }
  }

  /**
   * 广播在线用户列表
   */
  private async broadcastPresence(): Promise<void> {
    const users: PresenceInfo[] = [];
    for (const [, info] of this.connections.entries()) {
      users.push({
        userId: info.userId,
        sessionId: info.sessionId,
        connectedAt: info.connectedAt,
        lastActivity: info.lastHeartbeat,
        metadata: info.metadata,
      });
    }

    const presenceMessage: PresenceUpdateMessage = {
      type: "presence_update",
      users,
      timestamp: Date.now(),
    };

    await this.broadcastToAll(presenceMessage);
  }

  /**
   * REST: 获取当前状态
   */
  private handleGetState(): Response {
    return new Response(JSON.stringify(this.taskState), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * REST: 更新状态 (外部 API 调用)
   */
  private async handleStateUpdate(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as {
        changes: Record<string, unknown>;
        userId: string;
      };

      this.taskState = {
        ...this.taskState,
        ...body.changes,
        lastUpdatedBy: body.userId,
        lastUpdatedAt: Date.now(),
      };

      await this.state.storage.put("taskState", this.taskState);

      const stateMessage: StateUpdateMessage = {
        type: "state_update",
        taskId: "external",
        changes: body.changes,
        userId: body.userId,
        timestamp: Date.now(),
      };

      await this.broadcastToAll(stateMessage);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * REST: 获取在线用户列表
   */
  private handleGetPresence(): Response {
    const users: PresenceInfo[] = [];
    for (const [, info] of this.connections.entries()) {
      users.push({
        userId: info.userId,
        sessionId: info.sessionId,
        connectedAt: info.connectedAt,
        lastActivity: info.lastHeartbeat,
        metadata: info.metadata,
      });
    }

    return new Response(JSON.stringify({ users, count: users.length }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * REST: 广播自定义消息
   */
  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as WebSocketMessage;
      await this.broadcastToAll(body);

      return new Response(
        JSON.stringify({ success: true, recipients: this.connections.size }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
