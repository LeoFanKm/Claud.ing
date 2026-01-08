/**
 * @file tasks.test.ts
 * @description Tasks 路由单元测试
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock database service
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

// Mock auth middleware
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

import { createDatabaseService, DatabaseError } from "../services/database";
import { projectTaskRoutes, TaskStatus, taskRoutes } from "./tasks";

const mockCreateDatabaseService = createDatabaseService as ReturnType<
  typeof vi.fn
>;

// Test app setup for project tasks
function createProjectTasksApp() {
  const app = new Hono();
  app.route("/api/projects/:projectId/tasks", projectTaskRoutes);
  return app;
}

// Test app setup for individual tasks
function createTasksApp() {
  const app = new Hono();
  app.route("/api/tasks", taskRoutes);
  return app;
}

// Valid UUIDs for testing
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_PROJECT_UUID = "660e8400-e29b-41d4-a716-446655440001";
const VALID_ORG_UUID = "770e8400-e29b-41d4-a716-446655440002";
const VALID_USER_UUID = "880e8400-e29b-41d4-a716-446655440003";

describe("TaskStatus Constants", () => {
  it("should have correct status values", () => {
    expect(TaskStatus.TODO).toBe("todo");
    expect(TaskStatus.IN_PROGRESS).toBe("in-progress");
    expect(TaskStatus.IN_REVIEW).toBe("in-review");
    expect(TaskStatus.DONE).toBe("done");
    expect(TaskStatus.CANCELLED).toBe("cancelled");
  });
});

describe("Project Task Routes", () => {
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    queryOne: ReturnType<typeof vi.fn>;
    queryScalar: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: vi.fn(),
      queryOne: vi.fn(),
      queryScalar: vi.fn(),
    };
    mockCreateDatabaseService.mockReturnValue(mockDb);
  });

  describe("GET /api/projects/:projectId/tasks", () => {
    it("should return list of tasks", async () => {
      const app = createProjectTasksApp();
      const mockTasks = [
        {
          id: VALID_UUID,
          project_id: VALID_PROJECT_UUID,
          title: "Task 1",
          status: "todo",
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          project_id: VALID_PROJECT_UUID,
          title: "Task 2",
          status: "done",
        },
      ];

      // Project exists check
      mockDb.queryOne.mockResolvedValueOnce({ id: VALID_PROJECT_UUID });
      // Tasks query
      mockDb.query.mockResolvedValueOnce({ rows: mockTasks, rowCount: 2 });

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
    });

    it("should filter by status", async () => {
      const app = createProjectTasksApp();
      const mockTasks = [
        {
          id: VALID_UUID,
          project_id: VALID_PROJECT_UUID,
          title: "Task 1",
          status: "todo",
        },
      ];

      mockDb.queryOne.mockResolvedValueOnce({ id: VALID_PROJECT_UUID });
      mockDb.query.mockResolvedValueOnce({ rows: mockTasks, rowCount: 1 });

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks?status=todo`
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("AND status = $"),
        expect.arrayContaining(["todo"])
      );
    });

    it("should filter by assignee_id", async () => {
      const app = createProjectTasksApp();

      mockDb.queryOne.mockResolvedValueOnce({ id: VALID_PROJECT_UUID });
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks?assignee_id=${VALID_USER_UUID}`
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("AND assignee_user_id = $"),
        expect.arrayContaining([VALID_USER_UUID])
      );
    });

    it("should include deleted tasks when include_deleted=true", async () => {
      const app = createProjectTasksApp();

      mockDb.queryOne.mockResolvedValueOnce({ id: VALID_PROJECT_UUID });
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks?include_deleted=true`
      );

      expect(res.status).toBe(200);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.not.stringContaining("AND deleted_at IS NULL"),
        expect.any(Array)
      );
    });

    it("should return 400 for invalid project ID", async () => {
      const app = createProjectTasksApp();

      const res = await app.request("/api/projects/not-a-uuid/tasks");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid project ID format");
    });

    it("should return 400 for invalid assignee_id", async () => {
      const app = createProjectTasksApp();

      mockDb.queryOne.mockResolvedValueOnce({ id: VALID_PROJECT_UUID });

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks?assignee_id=not-a-uuid`
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid assignee ID format");
    });

    it("should return 404 for non-existent project", async () => {
      const app = createProjectTasksApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Project not found");
    });

    it("should return 500 on database error", async () => {
      const app = createProjectTasksApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to list tasks");
    });
  });

  describe("POST /api/projects/:projectId/tasks", () => {
    it("should create a task successfully", async () => {
      const app = createProjectTasksApp();
      const newTask = {
        id: VALID_UUID,
        project_id: VALID_PROJECT_UUID,
        organization_id: VALID_ORG_UUID,
        title: "New Task",
        status: "todo",
        creator_user_id: "user_123",
      };

      // Project exists check
      mockDb.queryOne.mockResolvedValueOnce({
        id: VALID_PROJECT_UUID,
        organization_id: VALID_ORG_UUID,
      });
      // Insert task
      mockDb.queryOne.mockResolvedValueOnce(newTask);

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Task" }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.title).toBe("New Task");
    });

    it("should create task with all fields", async () => {
      const app = createProjectTasksApp();
      const newTask = {
        id: VALID_UUID,
        project_id: VALID_PROJECT_UUID,
        organization_id: VALID_ORG_UUID,
        title: "New Task",
        description: "Task description",
        status: "in-progress",
        assignee_user_id: VALID_USER_UUID,
      };

      mockDb.queryOne.mockResolvedValueOnce({
        id: VALID_PROJECT_UUID,
        organization_id: VALID_ORG_UUID,
      });
      mockDb.queryOne.mockResolvedValueOnce(newTask);

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New Task",
            description: "Task description",
            status: "in-progress",
            assignee_user_id: VALID_USER_UUID,
          }),
        }
      );

      expect(res.status).toBe(201);
    });

    it("should return 400 for invalid project ID", async () => {
      const app = createProjectTasksApp();

      const res = await app.request("/api/projects/not-a-uuid/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Task" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid project ID format");
    });

    it("should return 400 for empty title", async () => {
      const app = createProjectTasksApp();

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "" }),
        }
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid status", async () => {
      const app = createProjectTasksApp();

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Task", status: "invalid-status" }),
        }
      );

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent project", async () => {
      const app = createProjectTasksApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Task" }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Project not found");
    });

    it("should return 404 on foreign key constraint error", async () => {
      const app = createProjectTasksApp();
      const dbError = new DatabaseError("Foreign key constraint", "23503");

      mockDb.queryOne.mockResolvedValueOnce({
        id: VALID_PROJECT_UUID,
        organization_id: VALID_ORG_UUID,
      });
      mockDb.queryOne.mockRejectedValueOnce(dbError);

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Task" }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Project or user not found");
    });

    it("should return 500 when insert returns null", async () => {
      const app = createProjectTasksApp();

      mockDb.queryOne.mockResolvedValueOnce({
        id: VALID_PROJECT_UUID,
        organization_id: VALID_ORG_UUID,
      });
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Task" }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to create task");
    });

    it("should return 500 on database error", async () => {
      const app = createProjectTasksApp();

      mockDb.queryOne.mockResolvedValueOnce({
        id: VALID_PROJECT_UUID,
        organization_id: VALID_ORG_UUID,
      });
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(
        `/api/projects/${VALID_PROJECT_UUID}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Task" }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to create task");
    });
  });
});

describe("Individual Task Routes", () => {
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    queryOne: ReturnType<typeof vi.fn>;
    queryScalar: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: vi.fn(),
      queryOne: vi.fn(),
      queryScalar: vi.fn(),
    };
    mockCreateDatabaseService.mockReturnValue(mockDb);
  });

  describe("GET /api/tasks/:id", () => {
    it("should return task by id", async () => {
      const app = createTasksApp();
      const task = {
        id: VALID_UUID,
        project_id: VALID_PROJECT_UUID,
        title: "Test Task",
        status: "todo",
      };

      mockDb.queryOne.mockResolvedValueOnce(task);

      const res = await app.request(`/api/tasks/${VALID_UUID}`);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(VALID_UUID);
    });

    it("should return 400 for invalid UUID", async () => {
      const app = createTasksApp();

      const res = await app.request("/api/tasks/not-a-uuid");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid task ID format");
    });

    it("should return 404 for non-existent task", async () => {
      const app = createTasksApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(`/api/tasks/${VALID_UUID}`);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Task not found");
    });

    it("should return 500 on database error", async () => {
      const app = createTasksApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(`/api/tasks/${VALID_UUID}`);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to get task");
    });
  });

  describe("PUT /api/tasks/:id", () => {
    it("should update task title", async () => {
      const app = createTasksApp();
      const existingTask = {
        id: VALID_UUID,
        title: "Old Title",
        status: "todo",
      };
      const updatedTask = {
        id: VALID_UUID,
        title: "New Title",
        status: "todo",
        version: 2,
      };

      mockDb.queryOne.mockResolvedValueOnce(existingTask);
      mockDb.queryOne.mockResolvedValueOnce(updatedTask);

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.title).toBe("New Title");
    });

    it("should update task status", async () => {
      const app = createTasksApp();
      const existingTask = { id: VALID_UUID, title: "Task", status: "todo" };
      const updatedTask = {
        id: VALID_UUID,
        title: "Task",
        status: "done",
        version: 2,
      };

      mockDb.queryOne.mockResolvedValueOnce(existingTask);
      mockDb.queryOne.mockResolvedValueOnce(updatedTask);

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.status).toBe("done");
    });

    it("should update task description", async () => {
      const app = createTasksApp();
      const existingTask = { id: VALID_UUID, title: "Task", description: null };
      const updatedTask = {
        id: VALID_UUID,
        title: "Task",
        description: "New description",
      };

      mockDb.queryOne.mockResolvedValueOnce(existingTask);
      mockDb.queryOne.mockResolvedValueOnce(updatedTask);

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "New description" }),
      });

      expect(res.status).toBe(200);
    });

    it("should update task assignee", async () => {
      const app = createTasksApp();
      const existingTask = {
        id: VALID_UUID,
        title: "Task",
        assignee_user_id: null,
      };
      const updatedTask = {
        id: VALID_UUID,
        title: "Task",
        assignee_user_id: VALID_USER_UUID,
      };

      mockDb.queryOne.mockResolvedValueOnce(existingTask);
      mockDb.queryOne.mockResolvedValueOnce(updatedTask);

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_user_id: VALID_USER_UUID }),
      });

      expect(res.status).toBe(200);
    });

    it("should update multiple fields", async () => {
      const app = createTasksApp();
      const existingTask = { id: VALID_UUID, title: "Task", status: "todo" };
      const updatedTask = {
        id: VALID_UUID,
        title: "New Title",
        status: "done",
        description: "Desc",
      };

      mockDb.queryOne.mockResolvedValueOnce(existingTask);
      mockDb.queryOne.mockResolvedValueOnce(updatedTask);

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Title",
          status: "done",
          description: "Desc",
        }),
      });

      expect(res.status).toBe(200);
    });

    it("should return 400 for invalid UUID", async () => {
      const app = createTasksApp();

      const res = await app.request("/api/tasks/not-a-uuid", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid task ID format");
    });

    it("should return 400 for no fields to update", async () => {
      const app = createTasksApp();

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("No fields to update");
    });

    it("should return 400 for invalid status", async () => {
      const app = createTasksApp();

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid-status" }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent task (first query)", async () => {
      const app = createTasksApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Task not found");
    });

    it("should return 404 for non-existent task (update query)", async () => {
      const app = createTasksApp();
      mockDb.queryOne.mockResolvedValueOnce({ id: VALID_UUID, title: "Task" });
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Task not found");
    });

    it("should return 404 on foreign key constraint error (assignee)", async () => {
      const app = createTasksApp();
      const dbError = new DatabaseError("Foreign key constraint", "23503");

      mockDb.queryOne.mockResolvedValueOnce({ id: VALID_UUID, title: "Task" });
      mockDb.queryOne.mockRejectedValueOnce(dbError);

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_user_id: VALID_USER_UUID }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Assignee user not found");
    });

    it("should return 500 on database error", async () => {
      const app = createTasksApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to update task");
    });
  });

  describe("PATCH /api/tasks/:id/status", () => {
    it("should update task status", async () => {
      const app = createTasksApp();
      const updatedTask = {
        id: VALID_UUID,
        title: "Task",
        status: "done",
        version: 2,
      };

      mockDb.queryOne.mockResolvedValueOnce(updatedTask);

      const res = await app.request(`/api/tasks/${VALID_UUID}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("done");
    });

    it("should accept all valid statuses", async () => {
      const app = createTasksApp();
      const statuses = [
        "todo",
        "in-progress",
        "in-review",
        "done",
        "cancelled",
      ];

      for (const status of statuses) {
        mockDb.queryOne.mockResolvedValueOnce({ id: VALID_UUID, status });

        const res = await app.request(`/api/tasks/${VALID_UUID}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });

        expect(res.status).toBe(200);
      }
    });

    it("should return 400 for invalid UUID", async () => {
      const app = createTasksApp();

      const res = await app.request("/api/tasks/not-a-uuid/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid task ID format");
    });

    it("should return 400 for invalid status", async () => {
      const app = createTasksApp();

      const res = await app.request(`/api/tasks/${VALID_UUID}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid-status" }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for missing status", async () => {
      const app = createTasksApp();

      const res = await app.request(`/api/tasks/${VALID_UUID}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent task", async () => {
      const app = createTasksApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(`/api/tasks/${VALID_UUID}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Task not found");
    });

    it("should return 500 on database error", async () => {
      const app = createTasksApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(`/api/tasks/${VALID_UUID}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to update task status");
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("should soft delete task successfully", async () => {
      const app = createTasksApp();
      mockDb.queryOne.mockResolvedValueOnce({ id: VALID_UUID });

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(true);
      expect(json.data.id).toBe(VALID_UUID);
    });

    it("should return 400 for invalid UUID", async () => {
      const app = createTasksApp();

      const res = await app.request("/api/tasks/not-a-uuid", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid task ID format");
    });

    it("should return 404 for non-existent task", async () => {
      const app = createTasksApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Task not found");
    });

    it("should return 500 on database error", async () => {
      const app = createTasksApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(`/api/tasks/${VALID_UUID}`, {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to delete task");
    });
  });
});

describe("Task Validation Schemas", () => {
  const taskStatusSchema = z.enum([
    "todo",
    "in-progress",
    "in-review",
    "done",
    "cancelled",
  ]);

  const createTaskSchema = z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(10_000).optional().nullable(),
    status: taskStatusSchema.optional().default("todo"),
    assignee_user_id: z.string().uuid().optional().nullable(),
  });

  const updateTaskSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(10_000).optional().nullable(),
    status: taskStatusSchema.optional(),
    assignee_user_id: z.string().uuid().optional().nullable(),
  });

  const updateStatusSchema = z.object({
    status: taskStatusSchema,
  });

  describe("taskStatusSchema", () => {
    it("should accept valid statuses", () => {
      expect(taskStatusSchema.safeParse("todo").success).toBe(true);
      expect(taskStatusSchema.safeParse("in-progress").success).toBe(true);
      expect(taskStatusSchema.safeParse("in-review").success).toBe(true);
      expect(taskStatusSchema.safeParse("done").success).toBe(true);
      expect(taskStatusSchema.safeParse("cancelled").success).toBe(true);
    });

    it("should reject invalid statuses", () => {
      expect(taskStatusSchema.safeParse("invalid").success).toBe(false);
      expect(taskStatusSchema.safeParse("").success).toBe(false);
      expect(taskStatusSchema.safeParse(123).success).toBe(false);
    });
  });

  describe("createTaskSchema", () => {
    it("should accept valid task data", () => {
      const result = createTaskSchema.safeParse({
        title: "Test Task",
      });
      expect(result.success).toBe(true);
    });

    it("should accept task with all fields", () => {
      const result = createTaskSchema.safeParse({
        title: "Test Task",
        description: "A description",
        status: "in-progress",
        assignee_user_id: VALID_USER_UUID,
      });
      expect(result.success).toBe(true);
    });

    it("should default status to todo", () => {
      const result = createTaskSchema.safeParse({
        title: "Test Task",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("todo");
      }
    });

    it("should reject empty title", () => {
      const result = createTaskSchema.safeParse({
        title: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject title exceeding max length", () => {
      const result = createTaskSchema.safeParse({
        title: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should reject description exceeding max length", () => {
      const result = createTaskSchema.safeParse({
        title: "Task",
        description: "a".repeat(10_001),
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid assignee_user_id", () => {
      const result = createTaskSchema.safeParse({
        title: "Task",
        assignee_user_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateTaskSchema", () => {
    it("should accept partial updates", () => {
      expect(updateTaskSchema.safeParse({ title: "New" }).success).toBe(true);
      expect(updateTaskSchema.safeParse({ status: "done" }).success).toBe(true);
      expect(updateTaskSchema.safeParse({ description: "desc" }).success).toBe(
        true
      );
    });

    it("should accept empty object", () => {
      const result = updateTaskSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept null description", () => {
      const result = updateTaskSchema.safeParse({
        description: null,
      });
      expect(result.success).toBe(true);
    });

    it("should accept null assignee_user_id", () => {
      const result = updateTaskSchema.safeParse({
        assignee_user_id: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateStatusSchema", () => {
    it("should require status field", () => {
      const result = updateStatusSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should accept valid status", () => {
      const result = updateStatusSchema.safeParse({ status: "done" });
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = updateStatusSchema.safeParse({ status: "invalid" });
      expect(result.success).toBe(false);
    });
  });
});

describe("UUID Validation", () => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("should validate valid UUIDs", () => {
    expect(uuidRegex.test(VALID_UUID)).toBe(true);
    expect(uuidRegex.test(VALID_PROJECT_UUID)).toBe(true);
    expect(uuidRegex.test(VALID_ORG_UUID)).toBe(true);
  });

  it("should reject invalid UUIDs", () => {
    expect(uuidRegex.test("not-a-uuid")).toBe(false);
    expect(uuidRegex.test("550e8400e29b41d4a716446655440000")).toBe(false);
    expect(uuidRegex.test("")).toBe(false);
  });
});
