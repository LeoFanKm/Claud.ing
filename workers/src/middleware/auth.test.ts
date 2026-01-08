/**
 * @file auth.test.ts
 * @description 认证中间件单元测试
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AuthBindings,
  authMiddleware,
  getSessionClaims,
  getUserId,
  isAuthenticated,
  requireAuth,
  requireRole,
  type SessionClaims,
} from "./auth";

// Mock @clerk/backend
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from "@clerk/backend";

const mockedVerifyToken = vi.mocked(verifyToken);

// Create mock environment
const createMockEnv = () => ({
  DB: {} as Hyperdrive,
  R2_BUCKET: {} as R2Bucket,
  TASK_SESSION: {} as DurableObjectNamespace,
  COLLABORATION_SESSION: {} as DurableObjectNamespace,
  CLERK_SECRET_KEY: "sk_test_secret",
  CLERK_PUBLISHABLE_KEY: "pk_test_publishable",
  STRIPE_SECRET_KEY: "sk_stripe_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  GITHUB_APP_ID: "app_id",
  GITHUB_APP_PRIVATE_KEY: "private_key",
  GITHUB_WEBHOOK_SECRET: "webhook_secret",
  GITHUB_APP_SLUG: "app_slug",
});

describe("Auth Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("authMiddleware", () => {
    it("should set null userId when no Authorization header", async () => {
      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        // Inject mock env
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.get("/test", (c) => {
        return c.json({
          userId: c.get("userId"),
          claims: c.get("sessionClaims"),
        });
      });

      const res = await app.request("/test");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.userId).toBeNull();
      expect(body.claims).toBeNull();
    });

    it("should set null userId when Authorization header is malformed", async () => {
      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") });
      });

      const res = await app.request("/test", {
        headers: { Authorization: "InvalidFormat token123" },
      });
      const body = await res.json();

      expect(body.userId).toBeNull();
    });

    it("should verify token and set userId on successful verification", async () => {
      const mockClaims: SessionClaims = {
        sub: "user_123",
        email: "test@example.com",
        role: "user",
      };

      mockedVerifyToken.mockResolvedValueOnce({
        data: mockClaims,
      } as any);

      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.get("/test", (c) => {
        return c.json({
          userId: c.get("userId"),
          claims: c.get("sessionClaims"),
        });
      });

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid_token_123" },
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.userId).toBe("user_123");
      expect(body.claims.email).toBe("test@example.com");
    });

    it("should set null userId when token verification fails", async () => {
      mockedVerifyToken.mockResolvedValueOnce({
        error: { message: "Token expired" },
      } as any);

      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") });
      });

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer invalid_token" },
      });
      const body = await res.json();

      expect(body.userId).toBeNull();
    });

    it("should set null userId when verifyToken throws", async () => {
      mockedVerifyToken.mockRejectedValueOnce(new Error("Network error"));

      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") });
      });

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer some_token" },
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.userId).toBeNull();
    });

    it("should pass correct options to verifyToken", async () => {
      mockedVerifyToken.mockResolvedValueOnce({
        data: { sub: "user_test" },
      } as any);

      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.get("/test", (c) => c.text("ok"));

      await app.request("/test", {
        headers: { Authorization: "Bearer test_token" },
      });

      expect(mockedVerifyToken).toHaveBeenCalledWith("test_token", {
        secretKey: "sk_test_secret",
        authorizedParties: [
          "http://localhost:5173",
          "http://localhost:3000",
          "https://claud.ing",
        ],
      });
    });
  });

  describe("requireAuth", () => {
    it("should return 401 when not authenticated", async () => {
      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.use("*", requireAuth);
      app.get("/test", (c) => c.text("protected"));

      const res = await app.request("/test");

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Authentication required");
    });

    it("should allow request when authenticated", async () => {
      mockedVerifyToken.mockResolvedValueOnce({
        data: { sub: "user_456" },
      } as any);

      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.use("*", requireAuth);
      app.get("/test", (c) => c.text("protected content"));

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid_token" },
      });

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("protected content");
    });
  });

  describe("requireRole", () => {
    it("should return 403 when user lacks required role", async () => {
      mockedVerifyToken.mockResolvedValueOnce({
        data: { sub: "user_789", role: "user" },
      } as any);

      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.use("*", requireAuth);
      app.use("*", requireRole(["admin"]));
      app.get("/test", (c) => c.text("admin only"));

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer user_token" },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Forbidden");
      expect(body.message).toContain("admin");
    });

    it("should allow request when user has required role", async () => {
      mockedVerifyToken.mockResolvedValueOnce({
        data: { sub: "admin_user", role: "admin" },
      } as any);

      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.use("*", requireAuth);
      app.use("*", requireRole(["admin", "superadmin"]));
      app.get("/test", (c) => c.text("admin content"));

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer admin_token" },
      });

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("admin content");
    });

    it("should return 403 when user has no role", async () => {
      mockedVerifyToken.mockResolvedValueOnce({
        data: { sub: "user_no_role" },
      } as any);

      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.use("*", requireAuth);
      app.use("*", requireRole(["admin"]));
      app.get("/test", (c) => c.text("protected"));

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer token" },
      });

      expect(res.status).toBe(403);
    });

    it("should support multiple allowed roles", async () => {
      mockedVerifyToken.mockResolvedValueOnce({
        data: { sub: "moderator_user", role: "moderator" },
      } as any);

      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.use("*", requireAuth);
      app.use("*", requireRole(["admin", "moderator", "editor"]));
      app.get("/test", (c) => c.text("content"));

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer mod_token" },
      });

      expect(res.status).toBe(200);
    });
  });

  describe("helper functions", () => {
    describe("getUserId", () => {
      it("should return userId from context", async () => {
        mockedVerifyToken.mockResolvedValueOnce({
          data: { sub: "user_helper_test" },
        } as any);

        let capturedUserId: string | null = null;

        const app = new Hono<AuthBindings>();
        app.use("*", async (c, next) => {
          c.env = createMockEnv() as any;
          await next();
        });
        app.use("*", authMiddleware);
        app.get("/test", (c) => {
          capturedUserId = getUserId(c);
          return c.text("ok");
        });

        await app.request("/test", {
          headers: { Authorization: "Bearer token" },
        });

        expect(capturedUserId).toBe("user_helper_test");
      });

      it("should return null when not authenticated", async () => {
        let capturedUserId: string | null = "initial";

        const app = new Hono<AuthBindings>();
        app.use("*", async (c, next) => {
          c.env = createMockEnv() as any;
          await next();
        });
        app.use("*", authMiddleware);
        app.get("/test", (c) => {
          capturedUserId = getUserId(c);
          return c.text("ok");
        });

        await app.request("/test");

        expect(capturedUserId).toBeNull();
      });
    });

    describe("getSessionClaims", () => {
      it("should return session claims from context", async () => {
        mockedVerifyToken.mockResolvedValueOnce({
          data: {
            sub: "user_claims_test",
            email: "claims@test.com",
            role: "editor",
            organization_id: "org_123",
          },
        } as any);

        let capturedClaims: SessionClaims | null = null;

        const app = new Hono<AuthBindings>();
        app.use("*", async (c, next) => {
          c.env = createMockEnv() as any;
          await next();
        });
        app.use("*", authMiddleware);
        app.get("/test", (c) => {
          capturedClaims = getSessionClaims(c);
          return c.text("ok");
        });

        await app.request("/test", {
          headers: { Authorization: "Bearer token" },
        });

        expect(capturedClaims).not.toBeNull();
        expect(capturedClaims?.sub).toBe("user_claims_test");
        expect(capturedClaims?.email).toBe("claims@test.com");
        expect(capturedClaims?.role).toBe("editor");
        expect(capturedClaims?.organization_id).toBe("org_123");
      });
    });

    describe("isAuthenticated", () => {
      it("should return true when authenticated", async () => {
        mockedVerifyToken.mockResolvedValueOnce({
          data: { sub: "user_auth_check" },
        } as any);

        let isAuth = false;

        const app = new Hono<AuthBindings>();
        app.use("*", async (c, next) => {
          c.env = createMockEnv() as any;
          await next();
        });
        app.use("*", authMiddleware);
        app.get("/test", (c) => {
          isAuth = isAuthenticated(c);
          return c.text("ok");
        });

        await app.request("/test", {
          headers: { Authorization: "Bearer token" },
        });

        expect(isAuth).toBe(true);
      });

      it("should return false when not authenticated", async () => {
        let isAuth = true;

        const app = new Hono<AuthBindings>();
        app.use("*", async (c, next) => {
          c.env = createMockEnv() as any;
          await next();
        });
        app.use("*", authMiddleware);
        app.get("/test", (c) => {
          isAuth = isAuthenticated(c);
          return c.text("ok");
        });

        await app.request("/test");

        expect(isAuth).toBe(false);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty Bearer token", async () => {
      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") });
      });

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer " },
      });
      const body = await res.json();

      // Empty token after "Bearer " should still try verification
      // and likely fail or be handled
      expect(res.status).toBe(200);
    });

    it("should handle unknown result format from verifyToken", async () => {
      mockedVerifyToken.mockResolvedValueOnce({} as any);

      const app = new Hono<AuthBindings>();
      app.use("*", async (c, next) => {
        c.env = createMockEnv() as any;
        await next();
      });
      app.use("*", authMiddleware);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") });
      });

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer unknown_format_token" },
      });
      const body = await res.json();

      expect(body.userId).toBeNull();
    });
  });
});
