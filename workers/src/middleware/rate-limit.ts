/**
 * @file rate-limit.ts
 * @description 速率限制中间件 - 滑动窗口算法实现
 *
 * @input RateLimitConfig 配置对象
 * @output Hono 中间件函数，超限返回 429
 * @position workers/src/middleware (中间件层)
 */

import type { Context, MiddlewareHandler } from "hono";

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  /** 时间窗口（毫秒），默认 60000 (1分钟) */
  windowMs: number;
  /** 时间窗口内最大请求数，默认 100 */
  maxRequests: number;
  /** 自定义获取客户端标识的函数 */
  keyGenerator?: (c: Context) => string;
  /** 超限时的自定义响应 */
  handler?: (c: Context, info: RateLimitInfo) => Response | Promise<Response>;
  /** 跳过速率限制的条件 */
  skip?: (c: Context) => boolean | Promise<boolean>;
  /** 是否在响应头中包含速率限制信息 */
  headers?: boolean;
}

/**
 * 速率限制信息
 */
export interface RateLimitInfo {
  /** 时间窗口内的最大请求数 */
  limit: number;
  /** 剩余请求数 */
  remaining: number;
  /** 重置时间（Unix 时间戳，秒） */
  reset: number;
  /** 是否被限制 */
  isLimited: boolean;
}

/**
 * 滑动窗口计数器存储接口
 */
interface RateLimitStore {
  /** 获取当前计数和窗口信息 */
  get(key: string): Promise<{ count: number; resetAt: number } | null>;
  /** 增加计数 */
  increment(
    key: string,
    windowMs: number
  ): Promise<{ count: number; resetAt: number }>;
}

/**
 * 内存存储实现（适用于单实例测试）
 */
class MemoryStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetAt: number }>();

  async get(key: string) {
    const record = this.store.get(key);
    if (!record) return null;

    // 检查是否过期
    if (Date.now() >= record.resetAt) {
      this.store.delete(key);
      return null;
    }

    return record;
  }

  async increment(key: string, windowMs: number) {
    const now = Date.now();
    const existing = this.store.get(key);

    // 如果记录存在且未过期
    if (existing && now < existing.resetAt) {
      existing.count++;
      return existing;
    }

    // 创建新记录
    const newRecord = {
      count: 1,
      resetAt: now + windowMs,
    };
    this.store.set(key, newRecord);

    // 定期清理过期记录
    this.cleanup();

    return newRecord;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now >= record.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// 全局内存存储实例
const memoryStore = new MemoryStore();

/**
 * 默认速率限制配置
 */
export const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 分钟
  maxRequests: 100, // 100 请求/分钟
  headers: true,
};

/**
 * 默认客户端标识生成器
 * 优先使用 CF-Connecting-IP，其次 X-Forwarded-For，最后 X-Real-IP
 */
function defaultKeyGenerator(c: Context): string {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    c.req.header("X-Real-IP") ||
    "unknown"
  );
}

/**
 * 默认超限响应处理器
 */
function defaultHandler(c: Context, info: RateLimitInfo): Response {
  return c.json(
    {
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${Math.ceil((info.reset * 1000 - Date.now()) / 1000)} seconds.`,
      retryAfter: Math.ceil((info.reset * 1000 - Date.now()) / 1000),
    },
    429
  );
}

/**
 * 创建速率限制中间件
 * @param config 速率限制配置（可选）
 */
export function createRateLimitMiddleware(
  config: Partial<RateLimitConfig> = {}
): MiddlewareHandler {
  const mergedConfig: RateLimitConfig = {
    ...defaultRateLimitConfig,
    ...config,
  };

  const keyGenerator = mergedConfig.keyGenerator || defaultKeyGenerator;
  const handler = mergedConfig.handler || defaultHandler;

  return async (c, next) => {
    // 检查是否跳过速率限制
    if (mergedConfig.skip) {
      const shouldSkip = await mergedConfig.skip(c);
      if (shouldSkip) {
        return next();
      }
    }

    // 生成客户端标识
    const key = `ratelimit:${keyGenerator(c)}`;

    // 增加计数并获取当前状态
    const { count, resetAt } = await memoryStore.increment(
      key,
      mergedConfig.windowMs
    );

    // 计算速率限制信息
    const info: RateLimitInfo = {
      limit: mergedConfig.maxRequests,
      remaining: Math.max(0, mergedConfig.maxRequests - count),
      reset: Math.ceil(resetAt / 1000), // 转换为秒
      isLimited: count > mergedConfig.maxRequests,
    };

    // 添加速率限制响应头
    if (mergedConfig.headers) {
      c.header("X-RateLimit-Limit", String(info.limit));
      c.header("X-RateLimit-Remaining", String(info.remaining));
      c.header("X-RateLimit-Reset", String(info.reset));
    }

    // 如果超限，返回 429
    if (info.isLimited) {
      c.header("Retry-After", String(Math.ceil((resetAt - Date.now()) / 1000)));
      return handler(c, info);
    }

    return next();
  };
}

/**
 * 创建基于路径的速率限制
 * 不同路径可以有不同的限制
 */
export function createPathBasedRateLimit(
  pathConfigs: Record<string, Partial<RateLimitConfig>>
): MiddlewareHandler {
  const middlewares = new Map<string, MiddlewareHandler>();

  for (const [path, config] of Object.entries(pathConfigs)) {
    middlewares.set(path, createRateLimitMiddleware(config));
  }

  // 默认中间件
  const defaultMiddleware = createRateLimitMiddleware();

  return async (c, next) => {
    const path = c.req.path;

    // 查找匹配的路径配置
    for (const [pattern, middleware] of middlewares.entries()) {
      if (path.startsWith(pattern)) {
        return middleware(c, next);
      }
    }

    // 使用默认配置
    return defaultMiddleware(c, next);
  };
}

/**
 * 预配置的 API 速率限制中间件
 * 100 请求/分钟
 */
export const apiRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 100,
});

/**
 * 预配置的严格速率限制中间件
 * 10 请求/分钟（适用于敏感操作）
 */
export const strictRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 10,
});

/**
 * 预配置的宽松速率限制中间件
 * 1000 请求/分钟（适用于高频操作）
 */
export const relaxedRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 1000,
});
