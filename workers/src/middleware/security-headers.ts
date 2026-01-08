/**
 * @file security-headers.ts
 * @description Security headers middleware for HTTP response hardening
 *
 * @input HTTP request context
 * @output HTTP response with security headers
 * @position workers/src/middleware (security layer)
 */

import type { MiddlewareHandler } from "hono";

/**
 * Security headers middleware
 * Adds recommended security headers to all responses
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  // Prevent clickjacking attacks
  c.header("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  c.header("X-Content-Type-Options", "nosniff");

  // Enable XSS filter (legacy browsers)
  c.header("X-XSS-Protection", "1; mode=block");

  // Control referrer information
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // Disable browser features we don't use
  c.header(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );

  // Content Security Policy
  // Note: Adjust based on actual requirements (Clerk, external scripts, etc.)
  c.header(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://clerk.claud.ing https://*.clerk.accounts.dev",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.clerk.dev https://*.clerk.accounts.dev wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );
};

/**
 * Minimal security headers for API responses
 * Lighter version without CSP (which may conflict with API clients)
 */
export const apiSecurityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
};
