/**
 * @file index.ts
 * @description Durable Objects 导出入口
 *
 * @position workers/src/durable-objects (Durable Objects 层)
 *
 * @lastModified 2026-01-02
 */

// Re-export CollaborationSession types
export type {
  AckMessage,
  BaseCollabMessage,
  CollabMessage,
  CollabMessageType,
  CollaboratorInfo,
  CursorMessage,
  CursorPosition,
  DocumentState,
  ErrorCollabMessage,
  HistoryEntry,
  JoinMessage,
  LeaveMessage,
  LockMessage,
  Operation,
  OperationMessage,
  OperationType,
  PresenceMessage,
  Selection,
  SyncMessage,
  TextOperation,
  UnlockMessage,
  UserCursor,
} from "./collaboration";
export { CollaborationSession } from "./collaboration";

// Re-export TaskSession types
export type {
  BaseMessage,
  ConnectMessage,
  CursorUpdateMessage,
  DisconnectMessage,
  ErrorMessage,
  HeartbeatMessage,
  MessageType,
  PresenceInfo,
  PresenceUpdateMessage,
  StateUpdateMessage,
  WebSocketMessage,
} from "./task-session";
export { TaskSession } from "./task-session";
