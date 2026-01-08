/**
 * @file claude.ts
 * @description Claude AI 执行器 - Anthropic API 集成与流式响应处理
 *
 * @input 用户消息、配置选项
 * @output AI 响应流 / 完整响应
 * @position workers/src/executors (AI 执行层)
 *
 * @lastModified 2026-01-02
 */

// ============================================================================
// 类型定义
// ============================================================================

/** Claude API 配置 */
export interface ClaudeConfig {
  apiKey: string;
  model?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  timeout?: number;
}

/** 支持的 Claude 模型 */
export type ClaudeModel =
  | "claude-sonnet-4-20250514"
  | "claude-opus-4-20250514"
  | "claude-3-5-sonnet-20241022"
  | "claude-3-5-haiku-20241022"
  | "claude-3-opus-20240229";

/** 消息角色 */
export type MessageRole = "user" | "assistant";

/** 消息内容 */
export interface Message {
  role: MessageRole;
  content: string;
}

/** 流式事件类型 */
export type StreamEventType =
  | "message_start"
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop"
  | "message_delta"
  | "message_stop"
  | "ping"
  | "error";

/** 流式事件 */
export interface StreamEvent {
  type: StreamEventType;
  index?: number;
  delta?: {
    type: string;
    text?: string;
    stop_reason?: string;
  };
  content_block?: {
    type: string;
    text?: string;
  };
  message?: {
    id: string;
    type: string;
    role: string;
    model: string;
    content: ContentBlock[];
    stop_reason?: string;
    usage?: Usage;
  };
  usage?: Usage;
  error?: {
    type: string;
    message: string;
  };
}

/** 内容块 */
export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/** Token 使用统计 */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** API 响应 */
export interface ClaudeResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: Usage;
}

/** 执行结果 */
export interface ExecutionResult {
  success: boolean;
  content: string;
  model: string;
  usage: Usage;
  stopReason: string | null;
  error?: string;
}

/** 流式回调 */
export interface StreamCallbacks {
  onStart?: (message: ClaudeResponse) => void;
  onToken?: (text: string) => void;
  onComplete?: (result: ExecutionResult) => void;
  onError?: (error: ClaudeError) => void;
}

/** 重试配置 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
}

// ============================================================================
// 错误处理
// ============================================================================

/** Claude 执行错误 */
export class ClaudeError extends Error {
  constructor(
    message: string,
    public readonly code: ClaudeErrorCode,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "ClaudeError";
  }

  static fromResponse(statusCode: number, body: string): ClaudeError {
    let message = body;
    let code: ClaudeErrorCode = "unknown_error";
    let retryable = false;

    try {
      const parsed = JSON.parse(body);
      message = parsed.error?.message || parsed.message || body;
      code = mapErrorCode(parsed.error?.type);
    } catch {
      // Keep original body as message
    }

    // Determine if retryable based on status code
    if ([429, 500, 502, 503, 504, 529].includes(statusCode)) {
      retryable = true;
    }

    return new ClaudeError(message, code, statusCode, retryable);
  }
}

/** 错误代码 */
export type ClaudeErrorCode =
  | "invalid_request"
  | "authentication_error"
  | "permission_denied"
  | "not_found"
  | "rate_limit"
  | "api_error"
  | "overloaded"
  | "timeout"
  | "network_error"
  | "stream_error"
  | "unknown_error";

function mapErrorCode(type?: string): ClaudeErrorCode {
  switch (type) {
    case "invalid_request_error":
      return "invalid_request";
    case "authentication_error":
      return "authentication_error";
    case "permission_error":
      return "permission_denied";
    case "not_found_error":
      return "not_found";
    case "rate_limit_error":
      return "rate_limit";
    case "api_error":
      return "api_error";
    case "overloaded_error":
      return "overloaded";
    default:
      return "unknown_error";
  }
}

// ============================================================================
// Claude 执行器
// ============================================================================

const DEFAULT_CONFIG: Required<Omit<ClaudeConfig, "apiKey" | "systemPrompt">> =
  {
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 120_000, // 2 minutes
  };

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  retryableStatusCodes: [429, 500, 502, 503, 504, 529],
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2024-10-22";

/**
 * Claude AI 执行器
 *
 * 提供：
 * - 直接 API 调用
 * - 流式响应处理
 * - 自动错误重试
 */
export class ClaudeExecutor {
  private readonly config: Required<Omit<ClaudeConfig, "systemPrompt">> & {
    systemPrompt?: string;
  };
  private readonly retryConfig: RetryConfig;

  constructor(config: ClaudeConfig, retryConfig?: Partial<RetryConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...retryConfig,
    };
  }

  // --------------------------------------------------------------------------
  // 公共方法
  // --------------------------------------------------------------------------

  /**
   * 执行同步 API 调用（非流式）
   */
  async execute(
    messages: Message[],
    options?: Partial<ClaudeConfig>
  ): Promise<ExecutionResult> {
    const mergedConfig = { ...this.config, ...options };
    const body = this.buildRequestBody(messages, mergedConfig, false);

    const response = await this.fetchWithRetry(body, mergedConfig.timeout);
    const data = (await response.json()) as ClaudeResponse;

    return this.parseResponse(data);
  }

  /**
   * 执行流式 API 调用
   * @returns ReadableStream 用于流式读取响应
   */
  async executeStream(
    messages: Message[],
    options?: Partial<ClaudeConfig>
  ): Promise<ReadableStream<Uint8Array>> {
    const mergedConfig = { ...this.config, ...options };
    const body = this.buildRequestBody(messages, mergedConfig, true);

    const response = await this.fetchWithRetry(body, mergedConfig.timeout);

    if (!response.body) {
      throw new ClaudeError("No response body", "stream_error");
    }

    return response.body;
  }

  /**
   * 执行流式 API 调用并使用回调处理
   */
  async executeWithCallbacks(
    messages: Message[],
    callbacks: StreamCallbacks,
    options?: Partial<ClaudeConfig>
  ): Promise<ExecutionResult> {
    const stream = await this.executeStream(messages, options);
    return this.processStreamWithCallbacks(stream, callbacks);
  }

  /**
   * 解析 SSE 流为事件迭代器
   */
  async *parseSSEStream(
    stream: ReadableStream<Uint8Array>
  ): AsyncGenerator<StreamEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 处理完整的 SSE 事件
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data) as StreamEvent;
              yield event;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // 处理剩余缓冲区
      if (buffer.startsWith("data: ")) {
        const data = buffer.slice(6).trim();
        if (data && data !== "[DONE]") {
          try {
            yield JSON.parse(data) as StreamEvent;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // --------------------------------------------------------------------------
  // 私有方法
  // --------------------------------------------------------------------------

  private buildRequestBody(
    messages: Message[],
    config: typeof this.config,
    stream: boolean
  ): string {
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages,
      stream,
    };

    if (config.systemPrompt) {
      body.system = config.systemPrompt;
    }

    return JSON.stringify(body);
  }

  private async fetchWithRetry(
    body: string,
    timeout: number
  ): Promise<Response> {
    let lastError: ClaudeError | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(body, timeout);

        // 成功响应
        if (response.ok) {
          return response;
        }

        // 构建错误
        const errorBody = await response.text();
        const error = ClaudeError.fromResponse(response.status, errorBody);

        // 非重试错误直接抛出
        if (!error.retryable) {
          throw error;
        }

        lastError = error;

        // 最后一次尝试不需要等待
        if (attempt < this.retryConfig.maxRetries) {
          await this.delay(attempt);
        }
      } catch (error) {
        if (error instanceof ClaudeError) {
          if (!error.retryable || attempt >= this.retryConfig.maxRetries) {
            throw error;
          }
          lastError = error;
        } else {
          // 网络错误可重试
          lastError = new ClaudeError(
            error instanceof Error ? error.message : "Network error",
            "network_error",
            undefined,
            true
          );

          if (attempt >= this.retryConfig.maxRetries) {
            throw lastError;
          }
        }

        // 等待后重试
        if (attempt < this.retryConfig.maxRetries) {
          await this.delay(attempt);
        }
      }
    }

    throw lastError || new ClaudeError("Max retries exceeded", "unknown_error");
  }

  private async fetchWithTimeout(
    body: string,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": ANTHROPIC_API_VERSION,
        },
        body,
        signal: controller.signal,
      });

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ClaudeError("Request timeout", "timeout", undefined, true);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async delay(attempt: number): Promise<void> {
    // 指数退避 + 抖动
    const delay = Math.min(
      this.retryConfig.baseDelayMs * 2 ** attempt + Math.random() * 1000,
      this.retryConfig.maxDelayMs
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private parseResponse(data: ClaudeResponse): ExecutionResult {
    const textContent = data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("");

    return {
      success: true,
      content: textContent,
      model: data.model,
      usage: data.usage,
      stopReason: data.stop_reason,
    };
  }

  private async processStreamWithCallbacks(
    stream: ReadableStream<Uint8Array>,
    callbacks: StreamCallbacks
  ): Promise<ExecutionResult> {
    let fullContent = "";
    let model = "";
    let usage: Usage = { input_tokens: 0, output_tokens: 0 };
    let stopReason: string | null = null;

    try {
      for await (const event of this.parseSSEStream(stream)) {
        switch (event.type) {
          case "message_start":
            if (event.message) {
              model = event.message.model;
              if (callbacks.onStart) {
                callbacks.onStart(event.message as ClaudeResponse);
              }
            }
            break;

          case "content_block_delta":
            if (event.delta?.text) {
              fullContent += event.delta.text;
              if (callbacks.onToken) {
                callbacks.onToken(event.delta.text);
              }
            }
            break;

          case "message_delta":
            if (event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
            if (event.usage) {
              usage = event.usage;
            }
            break;

          case "message_stop":
            // 流结束
            break;

          case "error":
            if (event.error) {
              const error = new ClaudeError(
                event.error.message,
                mapErrorCode(event.error.type)
              );
              if (callbacks.onError) {
                callbacks.onError(error);
              }
              throw error;
            }
            break;
        }
      }

      const result: ExecutionResult = {
        success: true,
        content: fullContent,
        model,
        usage,
        stopReason,
      };

      if (callbacks.onComplete) {
        callbacks.onComplete(result);
      }

      return result;
    } catch (error) {
      const claudeError =
        error instanceof ClaudeError
          ? error
          : new ClaudeError(
              error instanceof Error
                ? error.message
                : "Stream processing error",
              "stream_error"
            );

      if (callbacks.onError) {
        callbacks.onError(claudeError);
      }

      return {
        success: false,
        content: fullContent,
        model,
        usage,
        stopReason: null,
        error: claudeError.message,
      };
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建 Claude 执行器实例
 */
export function createClaudeExecutor(
  apiKey: string,
  options?: Partial<Omit<ClaudeConfig, "apiKey">>
): ClaudeExecutor {
  return new ClaudeExecutor({
    apiKey,
    ...options,
  });
}

/**
 * 快速执行单次对话（简化接口）
 */
export async function quickExecute(
  apiKey: string,
  prompt: string,
  options?: Partial<Omit<ClaudeConfig, "apiKey">>
): Promise<string> {
  const executor = createClaudeExecutor(apiKey, options);
  const result = await executor.execute([{ role: "user", content: prompt }]);

  if (!result.success) {
    throw new ClaudeError(result.error || "Execution failed", "unknown_error");
  }

  return result.content;
}

// ============================================================================
// 导出
// ============================================================================

export default ClaudeExecutor;
