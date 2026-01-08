/**
 * @file cors.test.ts
 * @description CORS 中间件单元测试
 */

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  corsMiddleware,
  createCorsMiddleware,
  defaultCorsConfig,
  developmentCors,
  isOriginAllowed,
  productionCors,
} from "./cors";

describe("CORS Middleware", () => {
  describe("isOriginAllowed", () => {
    it("should return true for exact match", () => {
      const allowedOrigins = ["https://claud.ing", "http://localhost:5173"];
      expect(isOriginAllowed("https://claud.ing", allowedOrigins)).toBe(true);
      expect(isOriginAllowed("http://localhost:5173", allowedOrigins)).toBe(
        true
      );
    });

    it("should return false for non-matching origins", () => {
      const allowedOrigins = ["https://claud.ing"];
      expect(isOriginAllowed("https://evil.com", allowedOrigins)).toBe(false);
      expect(isOriginAllowed("http://claud.ing", allowedOrigins)).toBe(false);
    });

    it("should support wildcard patterns", () => {
      const allowedOrigins = ["https://*.claud.ing", "http://localhost:*"];
      expect(isOriginAllowed("https://api.claud.ing", allowedOrigins)).toBe(
        true
      );
      expect(isOriginAllowed("https://sub.api.claud.ing", allowedOrigins)).toBe(
        true
      );
      expect(isOriginAllowed("http://localhost:3000", allowedOrigins)).toBe(
        true
      );
      expect(isOriginAllowed("http://localhost:8080", allowedOrigins)).toBe(
        true
      );
    });

    it("should return false for wildcard non-matches", () => {
      const allowedOrigins = ["https://*.claud.ing"];
      expect(isOriginAllowed("https://evil.com", allowedOrigins)).toBe(false);
    });

    it("should handle empty origin list", () => {
      expect(isOriginAllowed("https://any.com", [])).toBe(false);
    });
  });

  describe("createCorsMiddleware", () => {
    it("should allow requests from configured origins", async () => {
      const app = new Hono();
      app.use(
        "*",
        createCorsMiddleware({
          allowedOrigins: ["https://test.com"],
        })
      );
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { Origin: "https://test.com" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://test.com"
      );
    });

    it("should handle OPTIONS preflight requests", async () => {
      const app = new Hono();
      app.use(
        "*",
        createCorsMiddleware({
          allowedOrigins: ["https://test.com"],
          allowedMethods: ["GET", "POST"],
        })
      );

      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          Origin: "https://test.com",
          "Access-Control-Request-Method": "POST",
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });

    it("should not set CORS headers for disallowed origins", async () => {
      const app = new Hono();
      app.use(
        "*",
        createCorsMiddleware({
          allowedOrigins: ["https://allowed.com"],
        })
      );
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { Origin: "https://disallowed.com" },
      });

      expect(res.status).toBe(200);
      // Origin header should not be set to the disallowed origin
      expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe(
        "https://disallowed.com"
      );
    });

    it("should use default config when no options provided", async () => {
      const app = new Hono();
      app.use("*", createCorsMiddleware());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { Origin: "https://claud.ing" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://claud.ing"
      );
    });

    it("should set credentials header when configured", async () => {
      const app = new Hono();
      app.use(
        "*",
        createCorsMiddleware({
          allowedOrigins: ["https://test.com"],
          credentials: true,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { Origin: "https://test.com" },
      });

      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("should expose configured headers", async () => {
      const app = new Hono();
      app.use(
        "*",
        createCorsMiddleware({
          allowedOrigins: ["https://test.com"],
          exposedHeaders: ["X-Custom-Header", "X-Another"],
        })
      );
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { Origin: "https://test.com" },
      });

      const exposedHeaders = res.headers.get("Access-Control-Expose-Headers");
      expect(exposedHeaders).toContain("X-Custom-Header");
      expect(exposedHeaders).toContain("X-Another");
    });
  });

  describe("defaultCorsConfig", () => {
    it("should have correct default values", () => {
      expect(defaultCorsConfig.allowedOrigins).toContain("https://claud.ing");
      expect(defaultCorsConfig.allowedOrigins).toContain(
        "http://localhost:5173"
      );
      expect(defaultCorsConfig.allowedMethods).toContain("GET");
      expect(defaultCorsConfig.allowedMethods).toContain("POST");
      expect(defaultCorsConfig.credentials).toBe(true);
      expect(defaultCorsConfig.maxAge).toBe(86_400);
    });
  });

  describe("pre-configured middlewares", () => {
    it("corsMiddleware should work with default config", async () => {
      const app = new Hono();
      app.use("*", corsMiddleware);
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { Origin: "https://claud.ing" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://claud.ing"
      );
    });

    it("productionCors should only allow production origins", async () => {
      const app = new Hono();
      app.use("*", productionCors);
      app.get("/test", (c) => c.text("ok"));

      // Production origin should work
      const prodRes = await app.request("/test", {
        headers: { Origin: "https://claud.ing" },
      });
      expect(prodRes.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://claud.ing"
      );

      // Localhost should not work
      const devRes = await app.request("/test", {
        headers: { Origin: "http://localhost:5173" },
      });
      expect(devRes.headers.get("Access-Control-Allow-Origin")).not.toBe(
        "http://localhost:5173"
      );
    });

    it("developmentCors should only allow localhost origins", async () => {
      const app = new Hono();
      app.use("*", developmentCors);
      app.get("/test", (c) => c.text("ok"));

      // Localhost should work
      const devRes = await app.request("/test", {
        headers: { Origin: "http://localhost:5173" },
      });
      expect(devRes.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:5173"
      );

      // 127.0.0.1 should also work
      const dev2Res = await app.request("/test", {
        headers: { Origin: "http://127.0.0.1:3000" },
      });
      expect(dev2Res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://127.0.0.1:3000"
      );
    });
  });

  describe("same-origin requests", () => {
    it("should handle requests without Origin header", async () => {
      const app = new Hono();
      app.use("*", corsMiddleware);
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });
  });
});
