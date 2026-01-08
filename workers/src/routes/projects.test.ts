/**
 * @file projects.test.ts
 * @description Projects 路由单元测试
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
import projectRoutes from "./projects";

const mockCreateDatabaseService = createDatabaseService as ReturnType<
  typeof vi.fn
>;

// Test app setup
function createTestApp() {
  const app = new Hono();
  app.route("/api/projects", projectRoutes);
  return app;
}

// Valid UUIDs for testing
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_ORG_UUID = "660e8400-e29b-41d4-a716-446655440001";

describe("Projects Routes", () => {
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

  describe("GET /api/projects", () => {
    it("should return list of projects", async () => {
      const app = createTestApp();
      const mockProjects = [
        {
          id: VALID_UUID,
          organization_id: VALID_ORG_UUID,
          name: "Project 1",
          metadata: {},
          created_at: "2024-01-01",
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          organization_id: VALID_ORG_UUID,
          name: "Project 2",
          metadata: {},
          created_at: "2024-01-02",
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockProjects, rowCount: 2 });

      const res = await app.request("/api/projects");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
    });

    it("should filter by organization_id", async () => {
      const app = createTestApp();
      const mockProjects = [
        {
          id: VALID_UUID,
          organization_id: VALID_ORG_UUID,
          name: "Project 1",
          metadata: {},
          created_at: "2024-01-01",
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockProjects, rowCount: 1 });

      const res = await app.request(
        `/api/projects?organization_id=${VALID_ORG_UUID}`
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE organization_id = $1"),
        [VALID_ORG_UUID]
      );
    });

    it("should return 500 on database error", async () => {
      const app = createTestApp();
      mockDb.query.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request("/api/projects");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to list projects");
    });
  });

  describe("POST /api/projects", () => {
    it("should create a project successfully", async () => {
      const app = createTestApp();
      const newProject = {
        id: VALID_UUID,
        organization_id: VALID_ORG_UUID,
        name: "New Project",
        metadata: {},
        created_at: "2024-01-01",
      };

      mockDb.queryOne.mockResolvedValueOnce(newProject);

      const res = await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: VALID_ORG_UUID,
          name: "New Project",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("New Project");
    });

    it("should create a project with metadata", async () => {
      const app = createTestApp();
      const newProject = {
        id: VALID_UUID,
        organization_id: VALID_ORG_UUID,
        name: "New Project",
        metadata: { key: "value" },
        created_at: "2024-01-01",
      };

      mockDb.queryOne.mockResolvedValueOnce(newProject);

      const res = await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: VALID_ORG_UUID,
          name: "New Project",
          metadata: { key: "value" },
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
    });

    it("should return 400 for invalid organization_id", async () => {
      const app = createTestApp();

      const res = await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: "not-a-uuid",
          name: "New Project",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for empty name", async () => {
      const app = createTestApp();

      const res = await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: VALID_ORG_UUID,
          name: "",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent organization", async () => {
      const app = createTestApp();
      const dbError = new DatabaseError("Foreign key constraint", "23503");
      mockDb.queryOne.mockRejectedValueOnce(dbError);

      const res = await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: VALID_ORG_UUID,
          name: "New Project",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Organization not found");
    });

    it("should return 500 when insert returns null", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: VALID_ORG_UUID,
          name: "New Project",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to create project");
    });

    it("should return 500 on database error", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: VALID_ORG_UUID,
          name: "New Project",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to create project");
    });
  });

  describe("GET /api/projects/:id", () => {
    it("should return project by id", async () => {
      const app = createTestApp();
      const project = {
        id: VALID_UUID,
        organization_id: VALID_ORG_UUID,
        name: "Test Project",
        metadata: {},
        created_at: "2024-01-01",
      };

      mockDb.queryOne.mockResolvedValueOnce(project);

      const res = await app.request(`/api/projects/${VALID_UUID}`);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(VALID_UUID);
    });

    it("should return 400 for invalid UUID", async () => {
      const app = createTestApp();

      const res = await app.request("/api/projects/not-a-uuid");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid project ID format");
    });

    it("should return 404 for non-existent project", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(`/api/projects/${VALID_UUID}`);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Project not found");
    });

    it("should return 500 on database error", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(`/api/projects/${VALID_UUID}`);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to get project");
    });
  });

  describe("PUT /api/projects/:id", () => {
    it("should update project name", async () => {
      const app = createTestApp();
      const updatedProject = {
        id: VALID_UUID,
        organization_id: VALID_ORG_UUID,
        name: "Updated Name",
        metadata: {},
        created_at: "2024-01-01",
      };

      mockDb.queryOne.mockResolvedValueOnce(updatedProject);

      const res = await app.request(`/api/projects/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("Updated Name");
    });

    it("should update project metadata", async () => {
      const app = createTestApp();
      const updatedProject = {
        id: VALID_UUID,
        organization_id: VALID_ORG_UUID,
        name: "Project",
        metadata: { key: "new-value" },
        created_at: "2024-01-01",
      };

      mockDb.queryOne.mockResolvedValueOnce(updatedProject);

      const res = await app.request(`/api/projects/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: { key: "new-value" } }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it("should update both name and metadata", async () => {
      const app = createTestApp();
      const updatedProject = {
        id: VALID_UUID,
        organization_id: VALID_ORG_UUID,
        name: "New Name",
        metadata: { key: "value" },
        created_at: "2024-01-01",
      };

      mockDb.queryOne.mockResolvedValueOnce(updatedProject);

      const res = await app.request(`/api/projects/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name", metadata: { key: "value" } }),
      });

      expect(res.status).toBe(200);
    });

    it("should return 400 for invalid UUID", async () => {
      const app = createTestApp();

      const res = await app.request("/api/projects/not-a-uuid", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid project ID format");
    });

    it("should return 400 for no fields to update", async () => {
      const app = createTestApp();

      const res = await app.request(`/api/projects/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("No fields to update");
    });

    it("should return 404 for non-existent project", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(`/api/projects/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Project not found");
    });

    it("should return 500 on database error", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(`/api/projects/${VALID_UUID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to update project");
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("should delete project successfully", async () => {
      const app = createTestApp();
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: VALID_UUID }],
        rowCount: 1,
      });

      const res = await app.request(`/api/projects/${VALID_UUID}`, {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(true);
      expect(json.data.id).toBe(VALID_UUID);
    });

    it("should return 400 for invalid UUID", async () => {
      const app = createTestApp();

      const res = await app.request("/api/projects/not-a-uuid", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid project ID format");
    });

    it("should return 404 for non-existent project", async () => {
      const app = createTestApp();
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await app.request(`/api/projects/${VALID_UUID}`, {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Project not found");
    });

    it("should return 500 on database error", async () => {
      const app = createTestApp();
      mockDb.query.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(`/api/projects/${VALID_UUID}`, {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to delete project");
    });
  });
});

describe("Project Validation Schemas", () => {
  const createProjectSchema = z.object({
    organization_id: z.string().uuid(),
    name: z.string().min(1).max(255),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  });

  const updateProjectSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

  describe("createProjectSchema", () => {
    it("should accept valid project data", () => {
      const result = createProjectSchema.safeParse({
        organization_id: VALID_ORG_UUID,
        name: "Test Project",
      });
      expect(result.success).toBe(true);
    });

    it("should accept with metadata", () => {
      const result = createProjectSchema.safeParse({
        organization_id: VALID_ORG_UUID,
        name: "Test Project",
        metadata: { key: "value" },
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = createProjectSchema.safeParse({
        organization_id: "not-a-uuid",
        name: "Test Project",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty name", () => {
      const result = createProjectSchema.safeParse({
        organization_id: VALID_ORG_UUID,
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject name exceeding max length", () => {
      const result = createProjectSchema.safeParse({
        organization_id: VALID_ORG_UUID,
        name: "a".repeat(256),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateProjectSchema", () => {
    it("should accept valid name update", () => {
      const result = updateProjectSchema.safeParse({
        name: "Updated Name",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid metadata update", () => {
      const result = updateProjectSchema.safeParse({
        metadata: { key: "value" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object (no updates)", () => {
      const result = updateProjectSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject empty name", () => {
      const result = updateProjectSchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("UUID Validation", () => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("should validate valid UUIDs", () => {
    expect(uuidRegex.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(uuidRegex.test("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("should reject invalid UUIDs", () => {
    expect(uuidRegex.test("not-a-uuid")).toBe(false);
    expect(uuidRegex.test("550e8400e29b41d4a716446655440000")).toBe(false); // no dashes
    expect(uuidRegex.test("550e8400-e29b-61d4-a716-446655440000")).toBe(false); // version 6
    expect(uuidRegex.test("550e8400-e29b-41d4-0716-446655440000")).toBe(false); // variant wrong
  });
});

describe("API Response Helpers", () => {
  interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
  }

  function successResponse<T>(data: T): ApiResponse<T> {
    return { success: true, data };
  }

  function errorResponse(message: string): ApiResponse<never> {
    return { success: false, error: message, message };
  }

  it("should create success response", () => {
    const response = successResponse({ id: "123", name: "Test" });
    expect(response.success).toBe(true);
    expect(response.data).toEqual({ id: "123", name: "Test" });
  });

  it("should create error response", () => {
    const response = errorResponse("Something went wrong");
    expect(response.success).toBe(false);
    expect(response.error).toBe("Something went wrong");
    expect(response.message).toBe("Something went wrong");
  });
});
