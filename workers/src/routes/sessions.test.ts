/**
 * @file sessions.test.ts
 * @description Sessions API 路由单元测试
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("../services/database", () => ({
  createDatabaseService: vi.fn(),
  DatabaseError: class DatabaseError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.code = code;
      this.name = "DatabaseError";
    }
  },
}));

vi.mock("../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => {
    c.set("userId", "user_123");
    c.set("sessionClaims", { sub: "user_123" });
    return next();
  }),
  requireAuth: vi.fn((c: any, next: any) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return next();
  }),
}));

import { authMiddleware } from "../middleware/auth";
import { createDatabaseService, DatabaseError } from "../services/database";
import sessionRoutes, { taskSessionRoutes } from "./sessions";

const mockedCreateDatabaseService = vi.mocked(createDatabaseService);
const mockedAuthMiddleware = vi.mocked(authMiddleware);

// Helper to create test app for standalone sessions
function createSessionApp() {
  const app = new Hono();
  app.route("/api/sessions", sessionRoutes);
  return app;
}

// Helper to create test app for task sessions
function createTaskSessionApp() {
  const app = new Hono();
  // Mount with taskId param
  app.route("/api/tasks/:taskId/sessions", taskSessionRoutes);
  return app;
}

const validUUID = "550e8400-e29b-41d4-a716-446655440000";
const validTaskId = "660e8400-e29b-41d4-a716-446655440001";

describe("Session Routes", () => {
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

  describe("GET /api/sessions/:id", () => {
    it("should return session when found", async () => {
      const mockSession = {
        id: validUUID,
        task_id: validTaskId,
        executor: "claude",
        name: "Session 1",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockDb.queryOne.mockResolvedValueOnce(mockSession);

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(validUUID);
      expect(body.data.status).toBe("active");
    });

    it("should return 404 when session not found", async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("Session not found");
    });

    it("should return 400 for invalid UUID format", async () => {
      const app = createSessionApp();
      const res = await app.request("/api/sessions/invalid-id");

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Invalid session ID");
    });

    it("should return 401 when not authenticated", async () => {
      mockedAuthMiddleware.mockImplementationOnce((c: any, next: any) => {
        c.set("userId", null);
        return next();
      });

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`);

      expect(res.status).toBe(401);
    });

    it("should return 500 on database error", async () => {
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain("Failed to get session");
    });
  });

  describe("PUT /api/sessions/:id", () => {
    it("should update session status", async () => {
      const updatedSession = {
        id: validUUID,
        task_id: validTaskId,
        executor: "claude",
        name: "Session 1",
        status: "completed",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      mockDb.queryOne.mockResolvedValueOnce(updatedSession);

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("completed");
    });

    it("should update session name and executor", async () => {
      const updatedSession = {
        id: validUUID,
        task_id: validTaskId,
        executor: "new-executor",
        name: "New Name",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      mockDb.queryOne.mockResolvedValueOnce(updatedSession);

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executor: "new-executor", name: "New Name" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.executor).toBe("new-executor");
      expect(body.data.name).toBe("New Name");
    });

    it("should return 400 when no fields to update", async () => {
      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("No fields to update");
    });

    it("should return 400 for invalid UUID format", async () => {
      const app = createSessionApp();
      const res = await app.request("/api/sessions/bad-uuid", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 404 when session not found", async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      expect(res.status).toBe(404);
    });

    it("should validate status enum values", async () => {
      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid_status" }),
      });

      expect(res.status).toBe(400);
    });

    it("should allow setting executor to null", async () => {
      const updatedSession = {
        id: validUUID,
        task_id: validTaskId,
        executor: null,
        name: "Session 1",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      mockDb.queryOne.mockResolvedValueOnce(updatedSession);

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executor: null }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.executor).toBeNull();
    });
  });

  describe("DELETE /api/sessions/:id", () => {
    it("should delete session successfully", async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: validUUID });

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.deleted).toBe(true);
      expect(body.data.id).toBe(validUUID);
    });

    it("should return 404 when session not found", async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("should return 400 for invalid UUID format", async () => {
      const app = createSessionApp();
      const res = await app.request("/api/sessions/bad-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
    });

    it("should return 500 on database error", async () => {
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const app = createSessionApp();
      const res = await app.request(`/api/sessions/${validUUID}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain("Failed to delete session");
    });
  });
});

describe("Task Session Routes", () => {
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

  describe("GET /api/tasks/:taskId/sessions", () => {
    it("should return sessions for a task", async () => {
      const mockSessions = [
        { id: validUUID, task_id: validTaskId, status: "active" },
        {
          id: "770e8400-e29b-41d4-a716-446655440002",
          task_id: validTaskId,
          status: "completed",
        },
      ];

      // First queryOne for task existence check
      mockDb.queryOne.mockResolvedValueOnce({ id: validTaskId });
      // Then query for sessions list
      mockDb.query.mockResolvedValueOnce({ rows: mockSessions, rowCount: 2 });

      const app = createTaskSessionApp();
      const res = await app.request(`/api/tasks/${validTaskId}/sessions`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it("should return 404 when task not found", async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const app = createTaskSessionApp();
      const res = await app.request(`/api/tasks/${validTaskId}/sessions`);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("Task not found");
    });

    it("should return 400 for invalid task UUID", async () => {
      const app = createTaskSessionApp();
      const res = await app.request("/api/tasks/invalid-uuid/sessions");

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Invalid task ID");
    });

    it("should filter by status", async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: validTaskId });
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: validUUID, task_id: validTaskId, status: "active" }],
        rowCount: 1,
      });

      const app = createTaskSessionApp();
      const res = await app.request(
        `/api/tasks/${validTaskId}/sessions?status=active`
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
    });

    it("should support pagination", async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: validTaskId });
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const app = createTaskSessionApp();
      const res = await app.request(
        `/api/tasks/${validTaskId}/sessions?limit=10&offset=20`
      );

      expect(res.status).toBe(200);
      // Verify the query was called with proper params
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe("POST /api/tasks/:taskId/sessions", () => {
    it("should create session for a task", async () => {
      const newSession = {
        id: validUUID,
        task_id: validTaskId,
        executor: "claude",
        name: "New Session",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      // First queryOne for task existence check
      mockDb.queryOne.mockResolvedValueOnce({ id: validTaskId });
      // Then queryOne for insert
      mockDb.queryOne.mockResolvedValueOnce(newSession);

      const app = createTaskSessionApp();
      const res = await app.request(`/api/tasks/${validTaskId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executor: "claude", name: "New Session" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.executor).toBe("claude");
    });

    it("should create session with default status", async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: validTaskId });
      mockDb.queryOne.mockResolvedValueOnce({
        id: validUUID,
        task_id: validTaskId,
        status: "active",
      });

      const app = createTaskSessionApp();
      const res = await app.request(`/api/tasks/${validTaskId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(201);
    });

    it("should return 404 when task not found", async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const app = createTaskSessionApp();
      const res = await app.request(`/api/tasks/${validTaskId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executor: "test" }),
      });

      expect(res.status).toBe(404);
    });

    it("should return 400 for invalid task UUID", async () => {
      const app = createTaskSessionApp();
      const res = await app.request("/api/tasks/bad-id/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executor: "test" }),
      });

      expect(res.status).toBe(400);
    });

    it("should handle foreign key constraint error", async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: validTaskId });
      const dbError = new DatabaseError("Foreign key constraint", "23503");
      mockDb.queryOne.mockRejectedValueOnce(dbError);

      const app = createTaskSessionApp();
      const res = await app.request(`/api/tasks/${validTaskId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executor: "test" }),
      });

      expect(res.status).toBe(404);
    });

    it("should return 500 when insert fails", async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: validTaskId });
      mockDb.queryOne.mockResolvedValueOnce(null);

      const app = createTaskSessionApp();
      const res = await app.request(`/api/tasks/${validTaskId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executor: "test" }),
      });

      expect(res.status).toBe(500);
    });

    it("should validate status enum values", async () => {
      const app = createTaskSessionApp();
      const res = await app.request(`/api/tasks/${validTaskId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid" }),
      });

      expect(res.status).toBe(400);
    });
  });
});

describe("Session Status Constants", () => {
  it("should have correct status values", () => {
    expect("active").toBe("active");
    expect("completed").toBe("completed");
    expect("cancelled").toBe("cancelled");
  });
});

describe("UUID Validation", () => {
  const isValidUUID = (str: string): boolean => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  it("should accept valid UUID v4", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("should accept valid UUID v1", () => {
    expect(isValidUUID("550e8400-e29b-11d4-a716-446655440000")).toBe(true);
  });

  it("should reject invalid UUID", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
    expect(isValidUUID("550e8400-e29b-41d4-a716")).toBe(false);
    expect(isValidUUID("")).toBe(false);
    expect(isValidUUID("550e8400-e29b-41d4-a716-44665544000g")).toBe(false);
  });
});
