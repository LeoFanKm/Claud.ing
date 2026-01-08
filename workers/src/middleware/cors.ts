/**
 * @file cors.ts
 * @description CORS 中间件 - 可配置的跨域资源共享策略
 *
 * @input CorsConfig 配置对象
 * @output Hono 中间件函数
 * @position workers/src/middleware (中间件层)
 */

import type { MiddlewareHandler } from "hono";
import { cors as honoCors } from "hono/cors";

/**
 * CORS 配置选项
 */
export interface CorsConfig {
  /** 允许的源列表 */
  allowedOrigins: string[];
  /** 允许的 HTTP 方法 */
  allowedMethods?: string[];
  /** 允许的请求头 */
  allowedHeaders?: string[];
  /** 暴露给客户端的响应头 */
  exposedHeaders?: string[];
  /** 预检请求缓存时间（秒） */
  maxAge?: number;
  /** 是否允许携带凭证 */
  credentials?: boolean;
}

/**
 * 默认 CORS 配置
 */
export const defaultCorsConfig: CorsConfig = {
  allowedOrigins: [
    "https://claud.ing",
    "https://www.claud.ing",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  exposedHeaders: [
    "Content-Length",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ],
  maxAge: 86_400, // 24 小时
  credentials: true,
};

/**
 * 创建 CORS 中间件
 * @param config CORS 配置（可选，使用默认配置）
 */
export function createCorsMiddleware(
  config: Partial<CorsConfig> = {}
): MiddlewareHandler {
  const mergedConfig: CorsConfig = {
    ...defaultCorsConfig,
    ...config,
    // 合并数组配置
    allowedOrigins: config.allowedOrigins || defaultCorsConfig.allowedOrigins,
    allowedMethods: config.allowedMethods || defaultCorsConfig.allowedMethods,
    allowedHeaders: config.allowedHeaders || defaultCorsConfig.allowedHeaders,
    exposedHeaders: config.exposedHeaders || defaultCorsConfig.exposedHeaders,
  };

  return honoCors({
    origin: (origin) => {
      // 如果没有 origin（同源请求），允许
      if (!origin) return null;

      // 检查是否在允许列表中
      if (mergedConfig.allowedOrigins.includes(origin)) {
        return origin;
      }

      // 支持通配符模式匹配
      for (const allowed of mergedConfig.allowedOrigins) {
        if (allowed.includes("*")) {
          const pattern = new RegExp("^" + allowed.replace(/\*/g, ".*") + "$");
          if (pattern.test(origin)) {
            return origin;
          }
        }
      }

      // 不允许的源返回 null
      return null;
    },
    allowMethods: mergedConfig.allowedMethods,
    allowHeaders: mergedConfig.allowedHeaders,
    exposeHeaders: mergedConfig.exposedHeaders,
    maxAge: mergedConfig.maxAge,
    credentials: mergedConfig.credentials,
  });
}

/**
 * 检查源是否被允许
 * @param origin 请求源
 * @param allowedOrigins 允许的源列表
 */
export function isOriginAllowed(
  origin: string,
  allowedOrigins: string[]
): boolean {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  for (const allowed of allowedOrigins) {
    if (allowed.includes("*")) {
      const pattern = new RegExp("^" + allowed.replace(/\*/g, ".*") + "$");
      if (pattern.test(origin)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 预配置的生产环境 CORS 中间件
 */
export const productionCors = createCorsMiddleware({
  allowedOrigins: ["https://claud.ing", "https://www.claud.ing"],
});

/**
 * 预配置的开发环境 CORS 中间件
 */
export const developmentCors = createCorsMiddleware({
  allowedOrigins: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ],
});

/**
 * 默认 CORS 中间件（包含生产和开发环境）
 */
export const corsMiddleware = createCorsMiddleware();
