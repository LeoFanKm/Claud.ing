/**
 * @file organizations.test.ts
 * @description Organizations 路由单元测试
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
import organizationRoutes from "./organizations";

const mockCreateDatabaseService = createDatabaseService as ReturnType<
  typeof vi.fn
>;

// Test app setup
function createTestApp() {
  const app = new Hono();
  app.route("/api/organizations", organizationRoutes);
  return app;
}

// Valid UUIDs for testing
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_USER_UUID = "660e8400-e29b-41d4-a716-446655440001";

describe("Organization Routes", () => {
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

  describe("GET /api/organizations", () => {
    it("should return list of user organizations", async () => {
      const app = createTestApp();
      const mockOrgs = [
        {
          id: VALID_UUID,
          name: "Org 1",
          slug: "org-1",
          is_personal: false,
          created_at: "2024-01-01",
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          name: "Org 2",
          slug: "org-2",
          is_personal: true,
          created_at: "2024-01-02",
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockOrgs, rowCount: 2 });

      const res = await app.request("/api/organizations");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
    });

    it("should return empty list when user has no organizations", async () => {
      const app = createTestApp();
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await app.request("/api/organizations");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
    });

    it("should return 500 on database error", async () => {
      const app = createTestApp();
      mockDb.query.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request("/api/organizations");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to list organizations");
    });
  });

  describe("POST /api/organizations", () => {
    it("should create an organization successfully", async () => {
      const app = createTestApp();
      const newOrg = {
        id: VALID_UUID,
        name: "New Organization",
        slug: "new-org",
        is_personal: false,
        created_at: "2024-01-01",
      };

      mockDb.queryOne.mockResolvedValueOnce(newOrg);

      const res = await app.request("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Organization",
          slug: "new-org",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("New Organization");
      expect(json.data.slug).toBe("new-org");
    });

    it("should create personal organization", async () => {
      const app = createTestApp();
      const newOrg = {
        id: VALID_UUID,
        name: "Personal",
        slug: "personal-org",
        is_personal: true,
        created_at: "2024-01-01",
      };

      mockDb.queryOne.mockResolvedValueOnce(newOrg);

      const res = await app.request("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Personal",
          slug: "personal-org",
          is_personal: true,
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.is_personal).toBe(true);
    });

    it("should return 400 for empty name", async () => {
      const app = createTestApp();

      const res = await app.request("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          slug: "test-org",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid slug format", async () => {
      const app = createTestApp();

      const res = await app.request("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Org",
          slug: "Invalid_Slug!",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for empty slug", async () => {
      const app = createTestApp();

      const res = await app.request("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Org",
          slug: "",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 409 for duplicate slug", async () => {
      const app = createTestApp();
      const dbError = new DatabaseError("Unique constraint violation", "23505");
      mockDb.queryOne.mockRejectedValueOnce(dbError);

      const res = await app.request("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Org",
          slug: "existing-slug",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error).toBe("Organization slug already exists");
    });

    it("should return 500 when insert returns null", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Org",
          slug: "test-org",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to create organization");
    });

    it("should return 500 on database error", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Org",
          slug: "test-org",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to create organization");
    });
  });

  describe("GET /api/organizations/:id", () => {
    it("should return organization by id", async () => {
      const app = createTestApp();
      const org = {
        id: VALID_UUID,
        name: "Test Org",
        slug: "test-org",
        is_personal: false,
        created_at: "2024-01-01",
      };

      mockDb.queryOne.mockResolvedValueOnce(org);

      const res = await app.request(`/api/organizations/${VALID_UUID}`);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(VALID_UUID);
    });

    it("should return 400 for invalid UUID", async () => {
      const app = createTestApp();

      const res = await app.request("/api/organizations/not-a-uuid");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid organization ID format");
    });

    it("should return 404 for non-existent organization", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(`/api/organizations/${VALID_UUID}`);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Organization not found");
    });

    it("should return 500 on database error", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(`/api/organizations/${VALID_UUID}`);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to get organization");
    });
  });

  describe("GET /api/organizations/:id/members", () => {
    it("should return list of organization members", async () => {
      const app = createTestApp();
      const mockMembers = [
        {
          organization_id: VALID_UUID,
          user_id: "user_123",
          role: "admin",
          joined_at: "2024-01-01",
          last_seen_at: "2024-01-10",
          email: "admin@example.com",
          first_name: "Admin",
          last_name: "User",
        },
        {
          organization_id: VALID_UUID,
          user_id: "user_456",
          role: "member",
          joined_at: "2024-01-02",
          last_seen_at: null,
          email: "member@example.com",
          first_name: "Member",
          last_name: "User",
        },
      ];

      // Member check
      mockDb.queryOne.mockResolvedValueOnce({ 1: 1 });
      // Members query
      mockDb.query.mockResolvedValueOnce({ rows: mockMembers, rowCount: 2 });

      const res = await app.request(`/api/organizations/${VALID_UUID}/members`);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].role).toBe("admin");
    });

    it("should return 400 for invalid UUID", async () => {
      const app = createTestApp();

      const res = await app.request("/api/organizations/not-a-uuid/members");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid organization ID format");
    });

    it("should return 404 when user is not a member", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockResolvedValueOnce(null);

      const res = await app.request(`/api/organizations/${VALID_UUID}/members`);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Organization not found or access denied");
    });

    it("should return 500 on database error", async () => {
      const app = createTestApp();
      mockDb.queryOne.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(`/api/organizations/${VALID_UUID}/members`);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to list organization members");
    });
  });
});

describe("Organization Validation Schemas", () => {
  const createOrganizationSchema = z.object({
    name: z.string().min(1).max(255),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(
        /^[a-z0-9-]+$/,
        "Slug must be lowercase alphanumeric with hyphens"
      ),
    is_personal: z.boolean().optional().default(false),
  });

  describe("createOrganizationSchema", () => {
    it("should accept valid organization data", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Test Organization",
        slug: "test-org",
      });
      expect(result.success).toBe(true);
    });

    it("should accept with is_personal flag", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Personal Org",
        slug: "personal",
        is_personal: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_personal).toBe(true);
      }
    });

    it("should default is_personal to false", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Test Org",
        slug: "test-org",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_personal).toBe(false);
      }
    });

    it("should reject empty name", () => {
      const result = createOrganizationSchema.safeParse({
        name: "",
        slug: "test-org",
      });
      expect(result.success).toBe(false);
    });

    it("should reject name exceeding max length", () => {
      const result = createOrganizationSchema.safeParse({
        name: "a".repeat(256),
        slug: "test-org",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty slug", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Test Org",
        slug: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject slug exceeding max length", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Test Org",
        slug: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should reject slug with uppercase letters", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Test Org",
        slug: "Test-Org",
      });
      expect(result.success).toBe(false);
    });

    it("should reject slug with underscores", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Test Org",
        slug: "test_org",
      });
      expect(result.success).toBe(false);
    });

    it("should reject slug with spaces", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Test Org",
        slug: "test org",
      });
      expect(result.success).toBe(false);
    });

    it("should accept slug with numbers", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Test Org",
        slug: "test-org-123",
      });
      expect(result.success).toBe(true);
    });

    it("should accept slug with only hyphens and numbers", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Test Org",
        slug: "123-456-789",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("UUID Validation", () => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("should validate valid UUIDs", () => {
    expect(uuidRegex.test(VALID_UUID)).toBe(true);
    expect(uuidRegex.test("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("should reject invalid UUIDs", () => {
    expect(uuidRegex.test("not-a-uuid")).toBe(false);
    expect(uuidRegex.test("550e8400e29b41d4a716446655440000")).toBe(false);
    expect(uuidRegex.test("")).toBe(false);
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
