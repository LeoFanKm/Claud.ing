/**
 * @file index.ts
 * @description 中间件统一导出
 *
 * @position workers/src/middleware (中间件层入口)
 */

// 认证中间件 (Clerk)
export {
  type AuthBindings,
  type AuthVariables,
  authMiddleware,
  getSessionClaims,
  getUserId,
  isAuthenticated,
  requireAuth,
  requireRole,
  type SessionClaims,
} from "./auth";
// CORS 中间件
export {
  type CorsConfig,
  corsMiddleware,
  createCorsMiddleware,
  defaultCorsConfig,
  developmentCors,
  isOriginAllowed,
  productionCors,
} from "./cors";
// 速率限制中间件
export {
  apiRateLimit,
  createPathBasedRateLimit,
  createRateLimitMiddleware,
  defaultRateLimitConfig,
  type RateLimitConfig,
  type RateLimitInfo,
  relaxedRateLimit,
  strictRateLimit,
} from "./rate-limit";

// 安全头中间件
export { apiSecurityHeaders, securityHeaders } from "./security-headers";
