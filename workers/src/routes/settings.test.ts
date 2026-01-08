/**
 * @file settings.test.ts
 * @description Settings API 路由单元测试
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("../services/database", () => ({
  createDatabaseService: vi.fn(),
}));

vi.mock("../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => {
    // Default: set authenticated user
    c.set("userId", "user_123");
    c.set("sessionClaims", { sub: "user_123" });
    return next();
  }),
  requireAuth: vi.fn((c: any, next: any) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json(
        { error: "Unauthorized", message: "Authentication required" },
        401
      );
    }
    return next();
  }),
}));

import { authMiddleware, requireAuth } from "../middleware/auth";
import { createDatabaseService } from "../services/database";
import settingsRoutes from "./settings";

const mockedCreateDatabaseService = vi.mocked(createDatabaseService);
const mockedAuthMiddleware = vi.mocked(authMiddleware);
const mockedRequireAuth = vi.mocked(requireAuth);

// Helper to create test app with mocked dependencies
function createTestApp() {
  const app = new Hono();
  app.route("/api/settings", settingsRoutes);
  return app;
}

describe("Settings Routes", () => {
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    queryOne: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: vi.fn(),
      queryOne: vi.fn(),
    };

    mockedCreateDatabaseService.mockReturnValue(mockDb as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/settings", () => {
    it("should return existing user settings", async () => {
      const existingSettings = {
        id: "settings_1",
        user_id: "user_123",
        theme: "DARK",
        language: "EN",
        notifications: { sound_enabled: true, push_enabled: false },
        analytics_enabled: false,
        pr_auto_description_enabled: true,
        pr_auto_description_prompt: "Custom prompt",
        git_branch_prefix: "feature/",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      mockDb.queryOne.mockResolvedValueOnce(existingSettings);

      const app = createTestApp();
      const res = await app.request("/api/settings");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.theme).toBe("DARK");
      expect(body.data.language).toBe("EN");
    });

    it("should create default settings when none exist", async () => {
      const newSettings = {
        id: "settings_new",
        user_id: "user_123",
        theme: "SYSTEM",
        language: "EN",
        notifications: { sound_enabled: true, push_enabled: false },
        analytics_enabled: false,
        pr_auto_description_enabled: false,
        pr_auto_description_prompt: null,
        git_branch_prefix: "",
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      // First query returns null (no existing settings)
      mockDb.queryOne.mockResolvedValueOnce(null);
      // Second query inserts and returns new settings
      mockDb.queryOne.mockResolvedValueOnce(newSettings);

      const app = createTestApp();
      const res = await app.request("/api/settings");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.theme).toBe("SYSTEM");
    });

    it("should return 401 when not authenticated", async () => {
      mockedAuthMiddleware.mockImplementationOnce((c: any, next: any) => {
        c.set("userId", null);
        c.set("sessionClaims", null);
        return next();
      });

      const app = createTestApp();
      const res = await app.request("/api/settings");

      expect(res.status).toBe(401);
    });

    it("should return 500 on database error", async () => {
      mockDb.queryOne.mockRejectedValueOnce(
        new Error("Database connection failed")
      );

      const app = createTestApp();
      const res = await app.request("/api/settings");

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Failed to get settings");
    });
  });

  describe("PUT /api/settings", () => {
    it("should update theme setting", async () => {
      const updatedSettings = {
        id: "settings_1",
        user_id: "user_123",
        theme: "LIGHT",
        language: "EN",
        notifications: { sound_enabled: true, push_enabled: false },
        analytics_enabled: false,
        pr_auto_description_enabled: false,
        pr_auto_description_prompt: null,
        git_branch_prefix: "",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      mockDb.queryOne.mockResolvedValueOnce(updatedSettings);

      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "LIGHT" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.theme).toBe("LIGHT");
    });

    it("should update multiple settings at once", async () => {
      const updatedSettings = {
        id: "settings_1",
        user_id: "user_123",
        theme: "DARK",
        language: "JA",
        notifications: { sound_enabled: false, push_enabled: true },
        analytics_enabled: true,
        pr_auto_description_enabled: true,
        pr_auto_description_prompt: "New prompt",
        git_branch_prefix: "feat/",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      mockDb.queryOne.mockResolvedValueOnce(updatedSettings);

      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: "DARK",
          language: "JA",
          notifications: { sound_enabled: false, push_enabled: true },
          analytics_enabled: true,
          pr_auto_description_enabled: true,
          pr_auto_description_prompt: "New prompt",
          git_branch_prefix: "feat/",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.language).toBe("JA");
      expect(body.data.analytics_enabled).toBe(true);
    });

    it("should return 400 when no fields to update", async () => {
      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("No fields to update");
    });

    it("should validate theme enum values", async () => {
      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "INVALID_THEME" }),
      });

      expect(res.status).toBe(400);
    });

    it("should validate language string length", async () => {
      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "" }), // Empty string not allowed
      });

      expect(res.status).toBe(400);
    });

    it("should validate notifications object structure", async () => {
      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifications: { sound_enabled: "not a boolean" },
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should allow null pr_auto_description_prompt", async () => {
      const updatedSettings = {
        id: "settings_1",
        user_id: "user_123",
        theme: "SYSTEM",
        language: "EN",
        notifications: { sound_enabled: true, push_enabled: false },
        analytics_enabled: false,
        pr_auto_description_enabled: false,
        pr_auto_description_prompt: null,
        git_branch_prefix: "",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      mockDb.queryOne.mockResolvedValueOnce(updatedSettings);

      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pr_auto_description_prompt: null }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.pr_auto_description_prompt).toBeNull();
    });

    it("should validate pr_auto_description_prompt max length", async () => {
      const longPrompt = "a".repeat(2001); // Max is 2000

      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pr_auto_description_prompt: longPrompt }),
      });

      expect(res.status).toBe(400);
    });

    it("should validate git_branch_prefix max length", async () => {
      const longPrefix = "a".repeat(51); // Max is 50

      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ git_branch_prefix: longPrefix }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 401 when not authenticated", async () => {
      mockedAuthMiddleware.mockImplementationOnce((c: any, next: any) => {
        c.set("userId", null);
        c.set("sessionClaims", null);
        return next();
      });

      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "DARK" }),
      });

      expect(res.status).toBe(401);
    });

    it("should return 500 on database update error", async () => {
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "DARK" }),
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to update settings");
    });

    it("should return 500 when update returns null", async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "DARK" }),
      });

      expect(res.status).toBe(500);
    });
  });

  describe("Content-Type handling", () => {
    it("should require JSON content type for PUT", async () => {
      const app = createTestApp();
      const res = await app.request("/api/settings", {
        method: "PUT",
        body: "theme=DARK", // Form data instead of JSON
      });

      // Should fail validation since body isn't JSON
      expect(res.status).not.toBe(200);
    });
  });
});
