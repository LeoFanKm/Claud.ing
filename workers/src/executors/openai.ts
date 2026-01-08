/**
 * @file openai.ts
 * @description OpenAI AI 执行器 - OpenAI API 集成与流式响应处理
 *
 * @input 用户消息、配置选项
 * @output AI 响应流 / 完整响应
 * @position workers/src/executors (AI 执行层)
 *
 * @lastModified 2026-01-02
 */

import type {
  ExecutionResult,
  Message,
  MessageRole,
  RetryConfig,
  Usage,
} from "./claude";

// ============================================================================
// 类型定义
// ============================================================================

/** OpenAI API 配置 */
export interface OpenAIConfig {
  apiKey: string;
  model?: OpenAIModel;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  timeout?: number;
  baseUrl?: string; // 支持自定义 endpoint (Azure, 代理等)
}

/** 支持的 OpenAI 模型 */
export type OpenAIModel =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4-turbo"
  | "gpt-4"
  | "gpt-3.5-turbo"
  | "o1"
  | "o1-mini"
  | "o1-preview"
  | "o3-mini";

/** OpenAI 消息格式 */
export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** OpenAI 流式事件类型 */
export type OpenAIStreamEventType = "chunk" | "done" | "error";

/** OpenAI 流式块 */
export interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** OpenAI 完整响应 */
export interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** 流式回调 */
export interface OpenAIStreamCallbacks {
  onStart?: (id: string, model: string) => void;
  onToken?: (text: string) => void;
  onComplete?: (result: ExecutionResult) => void;
  onError?: (error: OpenAIError) => void;
}

// Re-export common types for convenience
export type { Message, MessageRole, Usage, ExecutionResult, RetryConfig };

// ============================================================================
// 错误处理
// ============================================================================

/** OpenAI 执行错误 */
export class OpenAIError extends Error {
  constructor(
    message: string,
    public readonly code: OpenAIErrorCode,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "OpenAIError";
  }

  static fromResponse(statusCode: number, body: string): OpenAIError {
    let message = body;
    let code: OpenAIErrorCode = "unknown_error";
    let retryable = false;

    try {
      const parsed = JSON.parse(body);
      message = parsed.error?.message || parsed.message || body;
      code = mapErrorCode(parsed.error?.type || parsed.error?.code);
    } catch {
      // Keep original body as message
    }

    // Determine if retryable based on status code
    if ([429, 500, 502, 503, 504].includes(statusCode)) {
      retryable = true;
    }

    return new OpenAIError(message, code, statusCode, retryable);
  }
}

/** 错误代码 */
export type OpenAIErrorCode =
  | "invalid_request"
  | "authentication_error"
  | "permission_denied"
  | "not_found"
  | "rate_limit"
  | "api_error"
  | "context_length_exceeded"
  | "timeout"
  | "network_error"
  | "stream_error"
  | "unknown_error";

function mapErrorCode(type?: string): OpenAIErrorCode {
  switch (type) {
    case "invalid_request_error":
    case "invalid_api_key":
      return "invalid_request";
    case "authentication_error":
      return "authentication_error";
    case "insufficient_quota":
    case "permission_denied":
      return "permission_denied";
    case "model_not_found":
    case "not_found":
      return "not_found";
    case "rate_limit_exceeded":
    case "rate_limit":
      return "rate_limit";
    case "context_length_exceeded":
      return "context_length_exceeded";
    case "server_error":
      return "api_error";
    default:
      return "unknown_error";
  }
}

// ============================================================================
// OpenAI 执行器
// ============================================================================

const DEFAULT_CONFIG: Required<
  Omit<OpenAIConfig, "apiKey" | "systemPrompt" | "baseUrl">
> = {
  model: "gpt-4o",
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 120_000, // 2 minutes
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * OpenAI AI 执行器
 *
 * 提供：
 * - 直接 API 调用
 * - 流式响应处理
 * - 自动错误重试
 * - 与 ClaudeExecutor 统一的接口
 */
export class OpenAIExecutor {
  private readonly config: Required<
    Omit<OpenAIConfig, "systemPrompt" | "baseUrl">
  > & {
    systemPrompt?: string;
    baseUrl?: string;
  };
  private readonly retryConfig: RetryConfig;

  constructor(config: OpenAIConfig, retryConfig?: Partial<RetryConfig>) {
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
    options?: Partial<OpenAIConfig>
  ): Promise<ExecutionResult> {
    const mergedConfig = { ...this.config, ...options };
    const body = this.buildRequestBody(messages, mergedConfig, false);

    const response = await this.fetchWithRetry(body, mergedConfig.timeout);
    const data = (await response.json()) as OpenAIResponse;

    return this.parseResponse(data);
  }

  /**
   * 执行流式 API 调用
   * @returns ReadableStream 用于流式读取响应
   */
  async executeStream(
    messages: Message[],
    options?: Partial<OpenAIConfig>
  ): Promise<ReadableStream<Uint8Array>> {
    const mergedConfig = { ...this.config, ...options };
    const body = this.buildRequestBody(messages, mergedConfig, true);

    const response = await this.fetchWithRetry(body, mergedConfig.timeout);

    if (!response.body) {
      throw new OpenAIError("No response body", "stream_error");
    }

    return response.body;
  }

  /**
   * 执行流式 API 调用并使用回调处理
   */
  async executeWithCallbacks(
    messages: Message[],
    callbacks: OpenAIStreamCallbacks,
    options?: Partial<OpenAIConfig>
  ): Promise<ExecutionResult> {
    const stream = await this.executeStream(messages, options);
    return this.processStreamWithCallbacks(stream, callbacks);
  }

  /**
   * 解析 SSE 流为事件迭代器
   */
  async *parseSSEStream(
    stream: ReadableStream<Uint8Array>
  ): AsyncGenerator<OpenAIStreamChunk> {
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
              const chunk = JSON.parse(data) as OpenAIStreamChunk;
              yield chunk;
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
            yield JSON.parse(data) as OpenAIStreamChunk;
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
    // 转换消息格式并添加系统提示
    const openaiMessages: OpenAIMessage[] = [];

    if (config.systemPrompt) {
      openaiMessages.push({
        role: "system",
        content: config.systemPrompt,
      });
    }

    for (const msg of messages) {
      openaiMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: openaiMessages,
      stream,
    };

    // 流式模式下请求返回 usage 统计
    if (stream) {
      body.stream_options = { include_usage: true };
    }

    return JSON.stringify(body);
  }

  private async fetchWithRetry(
    body: string,
    timeout: number
  ): Promise<Response> {
    let lastError: OpenAIError | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(body, timeout);

        // 成功响应
        if (response.ok) {
          return response;
        }

        // 构建错误
        const errorBody = await response.text();
        const error = OpenAIError.fromResponse(response.status, errorBody);

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
        if (error instanceof OpenAIError) {
          if (!error.retryable || attempt >= this.retryConfig.maxRetries) {
            throw error;
          }
          lastError = error;
        } else {
          // 网络错误可重试
          lastError = new OpenAIError(
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

    throw lastError || new OpenAIError("Max retries exceeded", "unknown_error");
  }

  private async fetchWithTimeout(
    body: string,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const apiUrl = this.config.baseUrl || OPENAI_API_URL;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body,
        signal: controller.signal,
      });

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new OpenAIError("Request timeout", "timeout", undefined, true);
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

  private parseResponse(data: OpenAIResponse): ExecutionResult {
    const content = data.choices[0]?.message?.content || "";

    return {
      success: true,
      content,
      model: data.model,
      usage: {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
      },
      stopReason: data.choices[0]?.finish_reason || null,
    };
  }

  private async processStreamWithCallbacks(
    stream: ReadableStream<Uint8Array>,
    callbacks: OpenAIStreamCallbacks
  ): Promise<ExecutionResult> {
    let fullContent = "";
    let model = "";
    let messageId = "";
    let usage: Usage = { input_tokens: 0, output_tokens: 0 };
    let stopReason: string | null = null;

    try {
      for await (const chunk of this.parseSSEStream(stream)) {
        // 第一个 chunk 触发 onStart
        if (!messageId && chunk.id) {
          messageId = chunk.id;
          model = chunk.model;
          if (callbacks.onStart) {
            callbacks.onStart(messageId, model);
          }
        }

        // 处理内容增量
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          if (callbacks.onToken) {
            callbacks.onToken(delta.content);
          }
        }

        // 处理完成原因
        if (chunk.choices[0]?.finish_reason) {
          stopReason = chunk.choices[0].finish_reason;
        }

        // 处理 usage（最后一个 chunk 包含）
        if (chunk.usage) {
          usage = {
            input_tokens: chunk.usage.prompt_tokens,
            output_tokens: chunk.usage.completion_tokens,
          };
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
      const openaiError =
        error instanceof OpenAIError
          ? error
          : new OpenAIError(
              error instanceof Error
                ? error.message
                : "Stream processing error",
              "stream_error"
            );

      if (callbacks.onError) {
        callbacks.onError(openaiError);
      }

      return {
        success: false,
        content: fullContent,
        model,
        usage,
        stopReason: null,
        error: openaiError.message,
      };
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建 OpenAI 执行器实例
 */
export function createOpenAIExecutor(
  apiKey: string,
  options?: Partial<Omit<OpenAIConfig, "apiKey">>
): OpenAIExecutor {
  return new OpenAIExecutor({
    apiKey,
    ...options,
  });
}

/**
 * 快速执行单次对话（简化接口）
 */
export async function quickExecuteOpenAI(
  apiKey: string,
  prompt: string,
  options?: Partial<Omit<OpenAIConfig, "apiKey">>
): Promise<string> {
  const executor = createOpenAIExecutor(apiKey, options);
  const result = await executor.execute([{ role: "user", content: prompt }]);

  if (!result.success) {
    throw new OpenAIError(result.error || "Execution failed", "unknown_error");
  }

  return result.content;
}

// ============================================================================
// 导出
// ============================================================================

export default OpenAIExecutor;
