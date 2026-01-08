/**
 * @file rate-limit.test.ts
 * @description 速率限制中间件单元测试
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPathBasedRateLimit,
  createRateLimitMiddleware,
  defaultRateLimitConfig,
  relaxedRateLimit,
  strictRateLimit,
} from "./rate-limit";

describe("Rate Limit Middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createRateLimitMiddleware", () => {
    it("should allow requests within limit", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 5,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // First 5 requests should succeed
      for (let i = 0; i < 5; i++) {
        const res = await app.request("/test", {
          headers: { "CF-Connecting-IP": "192.168.1.1" },
        });
        expect(res.status).toBe(200);
      }
    });

    it("should block requests exceeding limit", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 3,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // Make 3 requests (within limit)
      for (let i = 0; i < 3; i++) {
        const res = await app.request("/test", {
          headers: { "CF-Connecting-IP": "192.168.1.2" },
        });
        expect(res.status).toBe(200);
      }

      // 4th request should be blocked
      const res = await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.2" },
      });
      expect(res.status).toBe(429);

      const body = await res.json();
      expect(body.error).toBe("Too Many Requests");
    });

    it("should add rate limit headers", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 10,
          headers: true,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.3" },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
      expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
    });

    it("should not add headers when disabled", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 10,
          headers: false,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.4" },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
    });

    it("should reset after window expires", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 1000, // 1 second
          maxRequests: 2,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // Make 2 requests
      for (let i = 0; i < 2; i++) {
        await app.request("/test", {
          headers: { "CF-Connecting-IP": "192.168.1.5" },
        });
      }

      // 3rd request should be blocked
      const blockedRes = await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.5" },
      });
      expect(blockedRes.status).toBe(429);

      // Advance time past the window
      vi.advanceTimersByTime(1100);

      // Now request should succeed
      const allowedRes = await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.5" },
      });
      expect(allowedRes.status).toBe(200);
    });

    it("should use custom key generator", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 2,
          keyGenerator: (c) => c.req.header("X-API-Key") || "anonymous",
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // Same API key should share limit
      for (let i = 0; i < 2; i++) {
        const res = await app.request("/test", {
          headers: { "X-API-Key": "key-1" },
        });
        expect(res.status).toBe(200);
      }

      // 3rd request with same key should be blocked
      const blockedRes = await app.request("/test", {
        headers: { "X-API-Key": "key-1" },
      });
      expect(blockedRes.status).toBe(429);

      // Different key should have its own limit
      const differentKeyRes = await app.request("/test", {
        headers: { "X-API-Key": "key-2" },
      });
      expect(differentKeyRes.status).toBe(200);
    });

    it("should skip rate limiting when skip function returns true", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 1,
          skip: (c) => c.req.header("X-Admin-Token") === "secret",
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // Make request that uses the limit
      await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.6" },
      });

      // Next request without admin token should be blocked
      const blockedRes = await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.6" },
      });
      expect(blockedRes.status).toBe(429);

      // Request with admin token should bypass limit
      const adminRes = await app.request("/test", {
        headers: {
          "CF-Connecting-IP": "192.168.1.6",
          "X-Admin-Token": "secret",
        },
      });
      expect(adminRes.status).toBe(200);
    });

    it("should use custom handler for rate limit response", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 1,
          handler: (c, info) => {
            return c.json(
              {
                custom: true,
                limit: info.limit,
                remaining: info.remaining,
              },
              429
            );
          },
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // First request
      await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.7" },
      });

      // Second request should use custom handler
      const res = await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.7" },
      });

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.custom).toBe(true);
      expect(body.limit).toBe(1);
    });

    it("should add Retry-After header when rate limited", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 1,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.8" },
      });

      const res = await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.1.8" },
      });

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });
  });

  describe("IP detection", () => {
    it("should use CF-Connecting-IP first", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 1,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // First request with CF-Connecting-IP
      await app.request("/test", {
        headers: {
          "CF-Connecting-IP": "10.0.0.1",
          "X-Forwarded-For": "10.0.0.2",
        },
      });

      // Second request with same CF-Connecting-IP should be blocked
      const res = await app.request("/test", {
        headers: {
          "CF-Connecting-IP": "10.0.0.1",
          "X-Forwarded-For": "10.0.0.3", // Different forwarded IP
        },
      });
      expect(res.status).toBe(429);
    });

    it("should fall back to X-Forwarded-For", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 1,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      await app.request("/test", {
        headers: { "X-Forwarded-For": "10.0.0.4, 10.0.0.5" },
      });

      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "10.0.0.4, 10.0.0.6" }, // First IP same
      });
      expect(res.status).toBe(429);
    });

    it("should fall back to X-Real-IP", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 1,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      await app.request("/test", {
        headers: { "X-Real-IP": "10.0.0.7" },
      });

      const res = await app.request("/test", {
        headers: { "X-Real-IP": "10.0.0.7" },
      });
      expect(res.status).toBe(429);
    });
  });

  describe("createPathBasedRateLimit", () => {
    it("should apply different limits to different paths", async () => {
      const app = new Hono();
      app.use(
        "*",
        createPathBasedRateLimit({
          "/api/auth": { windowMs: 60_000, maxRequests: 2 },
          "/api/public": { windowMs: 60_000, maxRequests: 5 },
        })
      );
      app.get("/api/auth/login", (c) => c.text("login"));
      app.get("/api/public/data", (c) => c.text("data"));

      // Auth endpoint: 2 requests limit
      for (let i = 0; i < 2; i++) {
        const res = await app.request("/api/auth/login", {
          headers: { "CF-Connecting-IP": "192.168.100.1" },
        });
        expect(res.status).toBe(200);
      }
      const authBlocked = await app.request("/api/auth/login", {
        headers: { "CF-Connecting-IP": "192.168.100.1" },
      });
      expect(authBlocked.status).toBe(429);

      // Public endpoint: 5 requests limit (same IP, different path)
      for (let i = 0; i < 5; i++) {
        const res = await app.request("/api/public/data", {
          headers: { "CF-Connecting-IP": "192.168.100.2" },
        });
        expect(res.status).toBe(200);
      }
    });

    it("should use default limit for unconfigured paths", async () => {
      const app = new Hono();
      app.use(
        "*",
        createPathBasedRateLimit({
          "/api/special": { windowMs: 60_000, maxRequests: 1 },
        })
      );
      app.get("/api/other", (c) => c.text("other"));

      // Should use default (100 req/min)
      for (let i = 0; i < 10; i++) {
        const res = await app.request("/api/other", {
          headers: { "CF-Connecting-IP": "192.168.2.2" },
        });
        expect(res.status).toBe(200);
      }
    });
  });

  describe("pre-configured middlewares", () => {
    it("apiRateLimit should have 100 req/min", async () => {
      expect(defaultRateLimitConfig.maxRequests).toBe(100);
      expect(defaultRateLimitConfig.windowMs).toBe(60_000);
    });

    it("strictRateLimit should limit requests", async () => {
      const app = new Hono();
      app.use("*", strictRateLimit);
      app.get("/test", (c) => c.text("ok"));

      // Should allow 10 requests
      for (let i = 0; i < 10; i++) {
        const res = await app.request("/test", {
          headers: { "CF-Connecting-IP": "192.168.3.1" },
        });
        expect(res.status).toBe(200);
      }

      // 11th should be blocked
      const blocked = await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.3.1" },
      });
      expect(blocked.status).toBe(429);
    });

    it("relaxedRateLimit should allow many requests", async () => {
      const app = new Hono();
      app.use("*", relaxedRateLimit);
      app.get("/test", (c) => c.text("ok"));

      // Should allow many requests (up to 1000)
      for (let i = 0; i < 100; i++) {
        const res = await app.request("/test", {
          headers: { "CF-Connecting-IP": "192.168.3.2" },
        });
        expect(res.status).toBe(200);
      }
    });
  });

  describe("remaining count accuracy", () => {
    it("should correctly count remaining requests", async () => {
      const app = new Hono();
      app.use(
        "*",
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 5,
          headers: true,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      for (let i = 0; i < 5; i++) {
        const res = await app.request("/test", {
          headers: { "CF-Connecting-IP": "192.168.4.1" },
        });
        expect(res.headers.get("X-RateLimit-Remaining")).toBe(String(4 - i));
      }

      // After limit exceeded, remaining should be 0
      const blocked = await app.request("/test", {
        headers: { "CF-Connecting-IP": "192.168.4.1" },
      });
      expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
    });
  });
});
