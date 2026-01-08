/**
 * @file collaboration.ts
 * @description CollaborationSession Durable Object - 多用户实时协作编辑
 *
 * @input WebSocket 连接, 文本操作, 光标更新
 * @output 实时协作状态同步, 冲突解决后的操作广播
 * @position workers/src/durable-objects (Durable Objects 层)
 *
 * @lastModified 2026-01-02
 */

import type { Bindings } from "../index";

// ============================================================================
// Type Definitions
// ============================================================================

/** 操作类型 */
export type OperationType = "insert" | "delete" | "retain";

/** 单个操作 */
export interface Operation {
  type: OperationType;
  position: number;
  content?: string; // insert 时使用
  length?: number; // delete/retain 时使用
}

/** 文本操作消息 */
export interface TextOperation {
  revision: number;
  operations: Operation[];
  userId: string;
  timestamp: number;
}

/** 光标位置 */
export interface CursorPosition {
  line: number;
  column: number;
  offset: number; // 文档内的绝对位置
}

/** 选区 */
export interface Selection {
  anchor: CursorPosition;
  head: CursorPosition;
}

/** 用户光标状态 */
export interface UserCursor {
  userId: string;
  displayName: string;
  color: string;
  position: CursorPosition;
  selection?: Selection;
  lastUpdated: number;
}

/** 协作用户信息 */
export interface CollaboratorInfo {
  userId: string;
  displayName: string;
  color: string;
  connectedAt: number;
  lastActivity: number;
  isEditing: boolean;
}

/** 文档状态 */
export interface DocumentState {
  content: string;
  revision: number;
  lastModifiedBy: string;
  lastModifiedAt: number;
}

/** 操作历史条目 */
export interface HistoryEntry {
  operation: TextOperation;
  inverse: Operation[]; // 用于撤销
  timestamp: number;
}

// ============================================================================
// Message Types
// ============================================================================

export type CollabMessageType =
  | "join"
  | "leave"
  | "sync"
  | "operation"
  | "ack"
  | "cursor"
  | "presence"
  | "lock"
  | "unlock"
  | "error";

export interface BaseCollabMessage {
  type: CollabMessageType;
  timestamp: number;
}

/** 加入协作会话 */
export interface JoinMessage extends BaseCollabMessage {
  type: "join";
  userId: string;
  displayName: string;
}

/** 离开协作会话 */
export interface LeaveMessage extends BaseCollabMessage {
  type: "leave";
  userId: string;
}

/** 同步文档状态 */
export interface SyncMessage extends BaseCollabMessage {
  type: "sync";
  document: DocumentState;
  cursors: UserCursor[];
  collaborators: CollaboratorInfo[];
}

/** 文本操作 */
export interface OperationMessage extends BaseCollabMessage {
  type: "operation";
  operation: TextOperation;
}

/** 操作确认 */
export interface AckMessage extends BaseCollabMessage {
  type: "ack";
  revision: number;
  accepted: boolean;
  transformedOps?: Operation[];
}

/** 光标更新 */
export interface CursorMessage extends BaseCollabMessage {
  type: "cursor";
  cursor: UserCursor;
}

/** 在线状态更新 */
export interface PresenceMessage extends BaseCollabMessage {
  type: "presence";
  collaborators: CollaboratorInfo[];
}

/** 区域锁定请求 */
export interface LockMessage extends BaseCollabMessage {
  type: "lock";
  userId: string;
  range: { start: number; end: number };
  granted?: boolean;
}

/** 解除锁定 */
export interface UnlockMessage extends BaseCollabMessage {
  type: "unlock";
  userId: string;
  range: { start: number; end: number };
}

/** 错误消息 */
export interface ErrorCollabMessage extends BaseCollabMessage {
  type: "error";
  code: string;
  message: string;
}

export type CollabMessage =
  | JoinMessage
  | LeaveMessage
  | SyncMessage
  | OperationMessage
  | AckMessage
  | CursorMessage
  | PresenceMessage
  | LockMessage
  | UnlockMessage
  | ErrorCollabMessage;

// ============================================================================
// Connection Info
// ============================================================================

interface ConnectionInfo {
  userId: string;
  displayName: string;
  color: string;
  connectedAt: number;
  lastActivity: number;
  cursor?: UserCursor;
  pendingOps: TextOperation[];
}

// ============================================================================
// Constants
// ============================================================================

const USER_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
  "#F7DC6F", // Gold
  "#BB8FCE", // Purple
  "#85C1E9", // Light Blue
];

const HEARTBEAT_INTERVAL_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 90_000;
const MAX_HISTORY_SIZE = 1000;
const MAX_COLLABORATORS = 50;

// ============================================================================
// CollaborationSession Durable Object
// ============================================================================

/**
 * CollaborationSession Durable Object
 * 管理多用户实时协作编辑的状态同步和冲突处理
 */
export class CollaborationSession implements DurableObject {
  private connections: Map<WebSocket, ConnectionInfo> = new Map();
  private document: DocumentState = {
    content: "",
    revision: 0,
    lastModifiedBy: "system",
    lastModifiedAt: Date.now(),
  };
  private history: HistoryEntry[] = [];
  private locks: Map<string, { userId: string; start: number; end: number }> =
    new Map();
  private colorIndex = 0;

  constructor(
    private state: DurableObjectState,
    private env: Bindings
  ) {
    this.state.blockConcurrencyWhile(async () => {
      await this.loadState();
    });
  }

  /**
   * 加载持久化状态
   */
  private async loadState(): Promise<void> {
    const [doc, hist] = await Promise.all([
      this.state.storage.get<DocumentState>("document"),
      this.state.storage.get<HistoryEntry[]>("history"),
    ]);

    if (doc) this.document = doc;
    if (hist) this.history = hist;
  }

  /**
   * 保存状态
   */
  private async saveState(): Promise<void> {
    await Promise.all([
      this.state.storage.put("document", this.document),
      this.state.storage.put("history", this.history.slice(-MAX_HISTORY_SIZE)),
    ]);
  }

  /**
   * 处理传入请求
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    switch (path) {
      case "/document":
        return this.handleGetDocument();
      case "/collaborators":
        return this.handleGetCollaborators();
      case "/history":
        return this.handleGetHistory(url);
      default:
        return new Response("Not Found", { status: 404 });
    }
  }

  /**
   * 处理 WebSocket 升级
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    if (this.connections.size >= MAX_COLLABORATORS) {
      return new Response("Too many collaborators", { status: 503 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const displayName = url.searchParams.get("displayName") || userId;

    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);

    const color = this.assignColor();
    const connectionInfo: ConnectionInfo = {
      userId,
      displayName: displayName || userId,
      color,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      pendingOps: [],
    };
    this.connections.set(server, connectionInfo);

    // 发送初始同步消息
    const syncMessage: SyncMessage = {
      type: "sync",
      document: this.document,
      cursors: this.getAllCursors(),
      collaborators: this.getCollaborators(),
      timestamp: Date.now(),
    };
    server.send(JSON.stringify(syncMessage));

    // 广播新用户加入
    await this.broadcastPresence();
    await this.scheduleHeartbeatCheck();

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * 处理 WebSocket 消息
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

    connectionInfo.lastActivity = Date.now();

    try {
      const data =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      const parsed = JSON.parse(data) as CollabMessage;

      switch (parsed.type) {
        case "operation":
          await this.handleOperation(
            ws,
            connectionInfo,
            parsed as OperationMessage
          );
          break;
        case "cursor":
          await this.handleCursor(ws, connectionInfo, parsed as CursorMessage);
          break;
        case "lock":
          await this.handleLock(ws, connectionInfo, parsed as LockMessage);
          break;
        case "unlock":
          await this.handleUnlock(ws, connectionInfo, parsed as UnlockMessage);
          break;
        default:
          // 心跳等消息
          break;
      }
    } catch (error) {
      console.error("Failed to process message:", error);
      this.sendError(ws, "PARSE_ERROR", "Failed to parse message");
    }
  }

  /**
   * 处理文本操作
   */
  private async handleOperation(
    ws: WebSocket,
    connectionInfo: ConnectionInfo,
    message: OperationMessage
  ): Promise<void> {
    const { operation } = message;
    const expectedRevision = this.document.revision;

    // 检查版本号
    if (operation.revision < expectedRevision) {
      // 需要转换操作
      const transformedOps = this.transformOperations(
        operation.operations,
        operation.revision,
        expectedRevision
      );

      // 应用转换后的操作
      this.applyOperations(transformedOps, connectionInfo.userId);

      // 发送确认，包含转换后的操作
      const ack: AckMessage = {
        type: "ack",
        revision: this.document.revision,
        accepted: true,
        transformedOps,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(ack));

      // 广播转换后的操作给其他用户
      await this.broadcastOperation(ws, {
        ...operation,
        operations: transformedOps,
        revision: this.document.revision,
      });
    } else if (operation.revision === expectedRevision) {
      // 直接应用操作
      this.applyOperations(operation.operations, connectionInfo.userId);

      // 发送确认
      const ack: AckMessage = {
        type: "ack",
        revision: this.document.revision,
        accepted: true,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(ack));

      // 广播给其他用户
      await this.broadcastOperation(ws, {
        ...operation,
        revision: this.document.revision,
      });
    } else {
      // 版本号过高，客户端需要重新同步
      const ack: AckMessage = {
        type: "ack",
        revision: expectedRevision,
        accepted: false,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(ack));

      // 发送完整同步
      const sync: SyncMessage = {
        type: "sync",
        document: this.document,
        cursors: this.getAllCursors(),
        collaborators: this.getCollaborators(),
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(sync));
    }

    await this.saveState();
  }

  /**
   * 应用操作到文档
   */
  private applyOperations(operations: Operation[], userId: string): void {
    let content = this.document.content;
    let offset = 0;

    for (const op of operations) {
      const pos = op.position + offset;

      switch (op.type) {
        case "insert":
          if (op.content) {
            content = content.slice(0, pos) + op.content + content.slice(pos);
            offset += op.content.length;
          }
          break;
        case "delete":
          if (op.length) {
            content = content.slice(0, pos) + content.slice(pos + op.length);
            offset -= op.length;
          }
          break;
        case "retain":
          // 保留操作，不改变内容
          break;
      }
    }

    // 更新文档状态
    this.document = {
      content,
      revision: this.document.revision + 1,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    };

    // 记录历史
    this.history.push({
      operation: {
        revision: this.document.revision,
        operations,
        userId,
        timestamp: Date.now(),
      },
      inverse: this.createInverseOperations(operations, content),
      timestamp: Date.now(),
    });

    // 限制历史大小
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-MAX_HISTORY_SIZE);
    }
  }

  /**
   * 创建逆操作（用于撤销）
   */
  private createInverseOperations(
    operations: Operation[],
    originalContent: string
  ): Operation[] {
    const inverse: Operation[] = [];

    for (const op of operations) {
      switch (op.type) {
        case "insert":
          if (op.content) {
            inverse.push({
              type: "delete",
              position: op.position,
              length: op.content.length,
            });
          }
          break;
        case "delete":
          if (op.length) {
            const deletedContent = originalContent.slice(
              op.position,
              op.position + op.length
            );
            inverse.push({
              type: "insert",
              position: op.position,
              content: deletedContent,
            });
          }
          break;
        case "retain":
          inverse.push(op);
          break;
      }
    }

    return inverse.reverse();
  }

  /**
   * 操作转换 (OT) - 简化版
   * 将旧版本的操作转换为可以应用于当前版本的操作
   */
  private transformOperations(
    operations: Operation[],
    fromRevision: number,
    toRevision: number
  ): Operation[] {
    let transformed = [...operations];

    // 获取需要转换的历史操作
    const historyOps = this.history.filter(
      (h) =>
        h.operation.revision > fromRevision &&
        h.operation.revision <= toRevision
    );

    // 依次对每个历史操作进行转换
    for (const historyEntry of historyOps) {
      transformed = this.transformAgainst(
        transformed,
        historyEntry.operation.operations
      );
    }

    return transformed;
  }

  /**
   * 将 ops1 转换为可以在 ops2 之后应用的操作
   */
  private transformAgainst(ops1: Operation[], ops2: Operation[]): Operation[] {
    const result: Operation[] = [];

    for (const op1 of ops1) {
      let transformedOp = { ...op1 };

      for (const op2 of ops2) {
        transformedOp = this.transformSingle(transformedOp, op2);
      }

      result.push(transformedOp);
    }

    return result;
  }

  /**
   * 单个操作的转换
   */
  private transformSingle(op1: Operation, op2: Operation): Operation {
    const result = { ...op1 };

    if (op2.type === "insert" && op2.content) {
      // op2 在 op1 位置之前或相同位置插入
      if (op2.position <= op1.position) {
        result.position += op2.content.length;
      }
    } else if (
      op2.type === "delete" &&
      op2.length &&
      op2.position < op1.position
    ) {
      // op2 删除在 op1 之前
      const deleteEnd = op2.position + op2.length;
      if (deleteEnd <= op1.position) {
        // 完全在之前
        result.position -= op2.length;
      } else {
        // 部分重叠
        result.position = op2.position;
      }
    }

    return result;
  }

  /**
   * 处理光标更新
   */
  private async handleCursor(
    ws: WebSocket,
    connectionInfo: ConnectionInfo,
    message: CursorMessage
  ): Promise<void> {
    connectionInfo.cursor = message.cursor;

    // 广播给其他用户
    await this.broadcastToOthers(ws, message);
  }

  /**
   * 处理区域锁定
   */
  private async handleLock(
    ws: WebSocket,
    connectionInfo: ConnectionInfo,
    message: LockMessage
  ): Promise<void> {
    const lockKey = `${message.range.start}-${message.range.end}`;

    // 检查是否已被锁定
    const existingLock = this.locks.get(lockKey);
    if (existingLock && existingLock.userId !== connectionInfo.userId) {
      // 锁定被其他用户持有
      const response: LockMessage = {
        ...message,
        granted: false,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(response));
      return;
    }

    // 授予锁定
    this.locks.set(lockKey, {
      userId: connectionInfo.userId,
      start: message.range.start,
      end: message.range.end,
    });

    const response: LockMessage = {
      ...message,
      granted: true,
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(response));

    // 通知其他用户
    await this.broadcastToOthers(ws, response);
  }

  /**
   * 处理解除锁定
   */
  private async handleUnlock(
    ws: WebSocket,
    connectionInfo: ConnectionInfo,
    message: UnlockMessage
  ): Promise<void> {
    const lockKey = `${message.range.start}-${message.range.end}`;
    const lock = this.locks.get(lockKey);

    if (lock && lock.userId === connectionInfo.userId) {
      this.locks.delete(lockKey);
      await this.broadcastToOthers(ws, message);
    }
  }

  /**
   * WebSocket 关闭处理
   */
  async webSocketClose(ws: WebSocket): Promise<void> {
    const connectionInfo = this.connections.get(ws);
    if (connectionInfo) {
      // 释放该用户持有的所有锁
      for (const [key, lock] of this.locks.entries()) {
        if (lock.userId === connectionInfo.userId) {
          this.locks.delete(key);
        }
      }

      // 广播用户离开
      const leaveMessage: LeaveMessage = {
        type: "leave",
        userId: connectionInfo.userId,
        timestamp: Date.now(),
      };
      await this.broadcastToOthers(ws, leaveMessage);
    }

    this.connections.delete(ws);
    await this.broadcastPresence();
  }

  /**
   * WebSocket 错误处理
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error);
    await this.webSocketClose(ws);
  }

  /**
   * 定时器处理 - 心跳检测
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    const deadConnections: WebSocket[] = [];

    for (const [ws, info] of this.connections.entries()) {
      if (now - info.lastActivity > CONNECTION_TIMEOUT_MS) {
        deadConnections.push(ws);
      }
    }

    for (const ws of deadConnections) {
      try {
        ws.close(1000, "Connection timeout");
      } catch {
        // 忽略关闭错误
      }
      await this.webSocketClose(ws);
    }

    if (this.connections.size > 0) {
      await this.scheduleHeartbeatCheck();
    }
  }

  /**
   * 调度心跳检测
   */
  private async scheduleHeartbeatCheck(): Promise<void> {
    await this.state.storage.setAlarm(Date.now() + HEARTBEAT_INTERVAL_MS);
  }

  /**
   * 分配用户颜色
   */
  private assignColor(): string {
    const color = USER_COLORS[this.colorIndex % USER_COLORS.length];
    this.colorIndex++;
    return color;
  }

  /**
   * 获取所有光标
   */
  private getAllCursors(): UserCursor[] {
    const cursors: UserCursor[] = [];
    for (const [, info] of this.connections.entries()) {
      if (info.cursor) {
        cursors.push(info.cursor);
      }
    }
    return cursors;
  }

  /**
   * 获取协作者列表
   */
  private getCollaborators(): CollaboratorInfo[] {
    const collaborators: CollaboratorInfo[] = [];
    for (const [, info] of this.connections.entries()) {
      collaborators.push({
        userId: info.userId,
        displayName: info.displayName,
        color: info.color,
        connectedAt: info.connectedAt,
        lastActivity: info.lastActivity,
        isEditing: info.pendingOps.length > 0,
      });
    }
    return collaborators;
  }

  /**
   * 广播操作给其他用户
   */
  private async broadcastOperation(
    sender: WebSocket,
    operation: TextOperation
  ): Promise<void> {
    const message: OperationMessage = {
      type: "operation",
      operation,
      timestamp: Date.now(),
    };
    await this.broadcastToOthers(sender, message);
  }

  /**
   * 广播在线状态
   */
  private async broadcastPresence(): Promise<void> {
    const message: PresenceMessage = {
      type: "presence",
      collaborators: this.getCollaborators(),
      timestamp: Date.now(),
    };
    await this.broadcastToAll(message);
  }

  /**
   * 广播给除发送者外的所有用户
   */
  private async broadcastToOthers(
    sender: WebSocket,
    message: CollabMessage
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
   * 广播给所有用户
   */
  private async broadcastToAll(message: CollabMessage): Promise<void> {
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
   * 发送错误消息
   */
  private sendError(ws: WebSocket, code: string, message: string): void {
    const errorMessage: ErrorCollabMessage = {
      type: "error",
      code,
      message,
      timestamp: Date.now(),
    };
    try {
      ws.send(JSON.stringify(errorMessage));
    } catch {
      // 忽略发送错误
    }
  }

  // ============================================================================
  // REST API Handlers
  // ============================================================================

  /**
   * 获取文档状态
   */
  private handleGetDocument(): Response {
    return new Response(JSON.stringify(this.document), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * 获取协作者列表
   */
  private handleGetCollaborators(): Response {
    return new Response(JSON.stringify(this.getCollaborators()), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * 获取操作历史
   */
  private handleGetHistory(url: URL): Response {
    const limit = Number.parseInt(url.searchParams.get("limit") || "100");
    const fromRevision = Number.parseInt(url.searchParams.get("from") || "0");

    const filteredHistory = this.history
      .filter((h) => h.operation.revision > fromRevision)
      .slice(-limit);

    return new Response(JSON.stringify(filteredHistory), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
