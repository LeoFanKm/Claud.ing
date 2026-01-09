/**
 * @file auth.ts
 * @description Clerk 认证中间件 - JWT 验证、用户信息提取、权限检查
 *
 * @input Authorization header (Bearer token)
 * @output userId, sessionClaims in context variables
 * @position workers/src/middleware (认证层)
 *
 * @lastModified 2025-01-02
 */

import { verifyToken } from "@clerk/backend";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { Bindings } from "../index";

// Session claims from Clerk JWT
export interface SessionClaims {
  sub: string; // User ID
  email?: string;
  role?: string;
  organization_id?: string;
  [key: string]: unknown;
}

// Auth context variables
export type AuthVariables = {
  userId: string | null;
  sessionClaims: SessionClaims | null;
};

// Combined app type for routes with auth
export type AuthBindings = {
  Bindings: Bindings;
  Variables: AuthVariables;
};

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!(authHeader && authHeader.startsWith("Bearer "))) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Auth Middleware - Verifies Clerk JWT tokens
 *
 * This middleware:
 * - Extracts JWT from Authorization header
 * - Verifies token with Clerk (networkless if CLERK_JWT_KEY is set)
 * - Sets userId and sessionClaims in context
 * - Allows unauthenticated requests to continue (for public routes)
 *
 * Performance Note:
 * - With CLERK_JWT_KEY (PEM public key): Networkless verification < 1ms
 * - Without CLERK_JWT_KEY: Calls api.clerk.com (~200ms per request)
 *
 * Usage:
 * ```ts
 * app.use('/api/*', authMiddleware)
 * ```
 */
export const authMiddleware = createMiddleware<AuthBindings>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      // No token - continue as unauthenticated
      c.set("userId", null);
      c.set("sessionClaims", null);
      return next();
    }

    try {
      // Build verification options
      // Priority: jwtKey (networkless) > secretKey (API call)
      const verifyOptions: Parameters<typeof verifyToken>[1] = {
        // Authorized parties to prevent CSRF attacks
        authorizedParties: [
          "http://localhost:5173", // Vite dev
          "http://localhost:3000", // Alt dev
          "https://claud.ing", // Production
        ],
      };

      // Use jwtKey for networkless verification if available (RECOMMENDED)
      // This avoids ~200ms API calls to api.clerk.com per request
      if (c.env.CLERK_JWT_KEY) {
        verifyOptions.jwtKey = c.env.CLERK_JWT_KEY;
      } else {
        // Fallback to secretKey (will make API calls to Clerk)
        verifyOptions.secretKey = c.env.CLERK_SECRET_KEY;
      }

      // verifyToken returns JWT payload directly on success, throws on failure
      const claims = await verifyToken(token, verifyOptions);

      // Successful verification - set user context
      c.set("userId", claims.sub as string);
      c.set("sessionClaims", claims as unknown as SessionClaims);
    } catch (err) {
      console.error("[Auth] Token verification error:", err);
      c.set("userId", null);
      c.set("sessionClaims", null);
    }

    return next();
  }
);

/**
 * Require Auth Middleware - Returns 401 if not authenticated
 *
 * Use after authMiddleware to protect routes that require authentication.
 *
 * Usage:
 * ```ts
 * app.use('/api/protected/*', authMiddleware, requireAuth)
 * ```
 */
export const requireAuth = createMiddleware<AuthBindings>(async (c, next) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Authentication required",
      },
      401
    );
  }

  return next();
});

/**
 * Require Role Middleware - Returns 403 if user doesn't have required role
 *
 * @param allowedRoles - Array of roles that can access the route
 *
 * Usage:
 * ```ts
 * app.use('/api/admin/*', authMiddleware, requireAuth, requireRole(['admin']))
 * ```
 */
export function requireRole(allowedRoles: string[]) {
  return createMiddleware<AuthBindings>(async (c, next) => {
    const sessionClaims = c.get("sessionClaims");
    const role = sessionClaims?.role;

    if (!(role && allowedRoles.includes(role))) {
      return c.json(
        {
          error: "Forbidden",
          message: `Required role: ${allowedRoles.join(" or ")}`,
        },
        403
      );
    }

    return next();
  });
}

/**
 * Helper to get current user ID from context
 */
export function getUserId(c: Context<AuthBindings>): string | null {
  return c.get("userId");
}

/**
 * Helper to get session claims from context
 */
export function getSessionClaims(
  c: Context<AuthBindings>
): SessionClaims | null {
  return c.get("sessionClaims");
}

/**
 * Helper to check if user is authenticated
 */
export function isAuthenticated(c: Context<AuthBindings>): boolean {
  return c.get("userId") !== null;
}
