/**
 * @file index.ts
 * @description AI 执行器模块导出
 *
 * @position workers/src/executors (执行器入口)
 *
 * @lastModified 2026-01-02
 */

// ============================================================================
// Claude 执行器
// ============================================================================

export {
  // 类型
  type ClaudeConfig,
  ClaudeError,
  type ClaudeErrorCode,
  // 主类
  ClaudeExecutor,
  type ClaudeModel,
  type ClaudeResponse,
  type ContentBlock,
  // 工厂函数
  createClaudeExecutor,
  type ExecutionResult,
  type Message,
  type MessageRole,
  quickExecute,
  type RetryConfig,
  type StreamCallbacks,
  type StreamEvent,
  type StreamEventType,
  type Usage,
} from "./claude";

// ============================================================================
// OpenAI 执行器
// ============================================================================

export {
  // 工厂函数
  createOpenAIExecutor,
  // 类型
  type OpenAIConfig,
  OpenAIError,
  type OpenAIErrorCode,
  // 主类
  OpenAIExecutor,
  type OpenAIMessage,
  type OpenAIModel,
  type OpenAIResponse,
  type OpenAIStreamCallbacks,
  type OpenAIStreamChunk,
  quickExecuteOpenAI,
} from "./openai";
