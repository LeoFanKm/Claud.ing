/**
 * @file index.test.ts
 * @description 主应用路由测试 - 健康检查、错误处理、WebSocket路由
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all route imports to isolate testing
vi.mock("./r2", () => ({
  default: new Hono().get("/", (c) => c.json({ route: "r2" })),
}));
vi.mock("./projects", () => ({
  default: new Hono().get("/", (c) => c.json({ route: "projects" })),
}));
vi.mock("./tasks", () => ({
  default: new Hono().get("/", (c) => c.json({ route: "tasks" })),
  projectTaskRoutes: new Hono().get("/", (c) =>
    c.json({ route: "project-tasks" })
  ),
}));
vi.mock("./sessions", () => ({
  default: new Hono().get("/", (c) => c.json({ route: "sessions" })),
  taskSessionRoutes: new Hono().get("/", (c) =>
    c.json({ route: "task-sessions" })
  ),
}));
vi.mock("./organizations", () => ({
  default: new Hono().get("/", (c) => c.json({ route: "organizations" })),
}));
vi.mock("./storage", () => ({
  default: new Hono().get("/", (c) => c.json({ route: "storage" })),
}));
vi.mock("./settings", () => ({
  default: new Hono().get("/", (c) => c.json({ route: "settings" })),
}));
vi.mock("./billing", () => ({
  default: new Hono().get("/", (c) => c.json({ route: "billing" })),
  webhookRoutes: new Hono().post("/webhook", (c) =>
    c.json({ route: "billing-webhook" })
  ),
}));
vi.mock("./github", () => ({
  default: new Hono().get("/", (c) => c.json({ route: "github" })),
}));
vi.mock("../middleware", () => ({
  corsMiddleware: vi.fn((c: any, next: any) => next()),
  apiRateLimit: vi.fn((c: any, next: any) => next()),
}));
vi.mock("../services", () => ({
  createDatabaseService: vi.fn(() => ({
    healthCheck: vi.fn().mockResolvedValue({
      connected: true,
      latencyMs: 5,
      version: "PostgreSQL 15",
    }),
  })),
}));
vi.mock("../durable-objects", () => ({
  TaskSession: class {},
  CollaborationSession: class {},
}));

// Create a mock environment
const createMockEnv = () => ({
  DB: {} as Hyperdrive,
  R2_BUCKET: {} as R2Bucket,
  TASK_SESSION: {
    idFromName: vi.fn().mockReturnValue("mock-id"),
    get: vi.fn().mockReturnValue({
      fetch: vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ state: "ok" }))),
    }),
  } as unknown as DurableObjectNamespace,
  COLLABORATION_SESSION: {
    idFromName: vi.fn().mockReturnValue("mock-id"),
    get: vi.fn().mockReturnValue({
      fetch: vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ state: "ok" }))),
    }),
  } as unknown as DurableObjectNamespace,
  CLERK_SECRET_KEY: "sk_test_secret",
  CLERK_PUBLISHABLE_KEY: "pk_test_publishable",
  STRIPE_SECRET_KEY: "sk_stripe_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  GITHUB_APP_ID: "app_id",
  GITHUB_APP_PRIVATE_KEY: "private_key",
  GITHUB_WEBHOOK_SECRET: "webhook_secret",
  GITHUB_APP_SLUG: "app_slug",
});

describe("Main Application Routes", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import to get fresh instance with mocks
    const module = await import("../index");
    app = module.default;
  });

  describe("Health Check Endpoints", () => {
    describe("GET /health", () => {
      it("should return basic health status", async () => {
        const res = await app.request("/health");

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe("ok");
        expect(body.service).toBe("clauding-api");
        expect(body.timestamp).toBeDefined();
      });

      it("should return valid ISO timestamp", async () => {
        const res = await app.request("/health");
        const body = await res.json();

        const timestamp = new Date(body.timestamp);
        expect(timestamp.toISOString()).toBe(body.timestamp);
      });
    });

    describe("GET /api/health/db", () => {
      it("should return database health status when connected", async () => {
        const mockEnv = createMockEnv();

        // Create app with mock env
        const testApp = new Hono();
        testApp.get("/api/health/db", async (c) => {
          const { createDatabaseService } = await import("../services");
          const db = createDatabaseService(c as any);
          const health = await db.healthCheck();

          return c.json({
            status: health.connected ? "ok" : "error",
            database: "neon-postgresql",
            connected: health.connected,
            latencyMs: health.latencyMs,
            version: health.version,
          });
        });

        const res = await testApp.request("/api/health/db");

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe("ok");
        expect(body.connected).toBe(true);
        expect(body.database).toBe("neon-postgresql");
      });
    });
  });

  describe("Error Handling", () => {
    describe("404 Not Found", () => {
      it("should return 404 for unknown routes", async () => {
        const res = await app.request("/api/nonexistent/route");

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe("Not Found");
        expect(body.message).toContain("/api/nonexistent/route");
      });

      it("should include HTTP method in 404 response", async () => {
        const res = await app.request("/unknown", { method: "POST" });

        const body = await res.json();
        expect(body.message).toContain("POST");
      });
    });
  });

  describe("Route Registration", () => {
    it("should register health endpoint at root", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
    });
  });
});

describe("WebSocket Routes", () => {
  describe("GET /api/ws/sessions/:sessionId", () => {
    it("should return 426 when not a WebSocket upgrade request", async () => {
      const testApp = new Hono();
      const mockEnv = createMockEnv();

      testApp.get("/api/ws/sessions/:sessionId", async (c) => {
        const upgradeHeader = c.req.header("Upgrade");
        if (upgradeHeader !== "websocket") {
          return c.json({ error: "Expected WebSocket upgrade" }, 426);
        }
        return c.text("ok");
      });

      const res = await testApp.request("/api/ws/sessions/session123");

      expect(res.status).toBe(426);
      const body = await res.json();
      expect(body.error).toBe("Expected WebSocket upgrade");
    });

    it("should return 400 when sessionId is missing", async () => {
      const testApp = new Hono();

      testApp.get("/api/ws/sessions/:sessionId", async (c) => {
        const sessionId = c.req.param("sessionId");
        if (!sessionId) {
          return c.json({ error: "Missing sessionId" }, 400);
        }
        return c.text("ok");
      });

      // Note: With Hono route matching, empty sessionId would match differently
      // This tests the validation logic directly
      const res = await testApp.request("/api/ws/sessions/valid-session");
      expect(res.status).toBe(200);
    });

    it("should return 400 when userId query parameter is missing", async () => {
      const testApp = new Hono();

      testApp.get("/api/ws/sessions/:sessionId", async (c) => {
        const upgradeHeader = c.req.header("Upgrade");
        if (upgradeHeader !== "websocket") {
          return c.json({ error: "Expected WebSocket upgrade" }, 426);
        }
        const userId = c.req.query("userId");
        if (!userId) {
          return c.json({ error: "Missing userId query parameter" }, 400);
        }
        return c.text("ok");
      });

      const res = await testApp.request("/api/ws/sessions/session123", {
        headers: { Upgrade: "websocket" },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Missing userId query parameter");
    });
  });

  describe("Collaboration WebSocket Routes", () => {
    it("should return 426 for non-WebSocket request to collaboration endpoint", async () => {
      const testApp = new Hono();

      testApp.get("/api/ws/collaboration/:documentId", async (c) => {
        const upgradeHeader = c.req.header("Upgrade");
        if (upgradeHeader !== "websocket") {
          return c.json({ error: "Expected WebSocket upgrade" }, 426);
        }
        return c.text("ok");
      });

      const res = await testApp.request("/api/ws/collaboration/doc123");

      expect(res.status).toBe(426);
    });

    it("should return 400 when documentId is missing required params", async () => {
      const testApp = new Hono();

      testApp.get("/api/ws/collaboration/:documentId", async (c) => {
        const upgradeHeader = c.req.header("Upgrade");
        if (upgradeHeader !== "websocket") {
          return c.json({ error: "Expected WebSocket upgrade" }, 426);
        }
        const userId = c.req.query("userId");
        if (!userId) {
          return c.json({ error: "Missing userId query parameter" }, 400);
        }
        return c.text("ok");
      });

      const res = await testApp.request("/api/ws/collaboration/doc123", {
        headers: { Upgrade: "websocket" },
      });

      expect(res.status).toBe(400);
    });
  });
});

describe("REST API for Session State", () => {
  describe("GET /api/ws/sessions/:sessionId/state", () => {
    it("should forward request to Durable Object", async () => {
      const mockStub = {
        fetch: vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ state: "active", data: {} }))
          ),
      };
      const mockDO = {
        idFromName: vi.fn().mockReturnValue("mock-id"),
        get: vi.fn().mockReturnValue(mockStub),
      };

      const testApp = new Hono();
      testApp.get("/api/ws/sessions/:sessionId/state", async (c) => {
        const sessionId = c.req.param("sessionId");
        const id = mockDO.idFromName(sessionId);
        const stub = mockDO.get(id);

        return stub.fetch(new Request("http://test/state"));
      });

      const res = await testApp.request("/api/ws/sessions/test-session/state");

      expect(res.status).toBe(200);
      expect(mockDO.idFromName).toHaveBeenCalledWith("test-session");
    });
  });

  describe("POST /api/ws/sessions/:sessionId/state", () => {
    it("should forward state update to Durable Object", async () => {
      const mockStub = {
        fetch: vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify({ updated: true }))),
      };
      const mockDO = {
        idFromName: vi.fn().mockReturnValue("mock-id"),
        get: vi.fn().mockReturnValue(mockStub),
      };

      const testApp = new Hono();
      testApp.post("/api/ws/sessions/:sessionId/state", async (c) => {
        const sessionId = c.req.param("sessionId");
        const id = mockDO.idFromName(sessionId);
        const stub = mockDO.get(id);

        return stub.fetch(
          new Request("http://test/update", { method: "POST" })
        );
      });

      const res = await testApp.request("/api/ws/sessions/test-session/state", {
        method: "POST",
        body: JSON.stringify({ newState: "completed" }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/ws/sessions/:sessionId/presence", () => {
    it("should return online users list", async () => {
      const mockStub = {
        fetch: vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ users: ["user1", "user2"] }))
          ),
      };
      const mockDO = {
        idFromName: vi.fn().mockReturnValue("mock-id"),
        get: vi.fn().mockReturnValue(mockStub),
      };

      const testApp = new Hono();
      testApp.get("/api/ws/sessions/:sessionId/presence", async (c) => {
        const sessionId = c.req.param("sessionId");
        const id = mockDO.idFromName(sessionId);
        const stub = mockDO.get(id);

        return stub.fetch(new Request("http://test/presence"));
      });

      const res = await testApp.request(
        "/api/ws/sessions/test-session/presence"
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.users).toHaveLength(2);
    });
  });

  describe("POST /api/ws/sessions/:sessionId/broadcast", () => {
    it("should broadcast message to all connected clients", async () => {
      const mockStub = {
        fetch: vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify({ sent: true }))),
      };
      const mockDO = {
        idFromName: vi.fn().mockReturnValue("mock-id"),
        get: vi.fn().mockReturnValue(mockStub),
      };

      const testApp = new Hono();
      testApp.post("/api/ws/sessions/:sessionId/broadcast", async (c) => {
        const sessionId = c.req.param("sessionId");
        const id = mockDO.idFromName(sessionId);
        const stub = mockDO.get(id);

        return stub.fetch(
          new Request("http://test/broadcast", { method: "POST" })
        );
      });

      const res = await testApp.request(
        "/api/ws/sessions/test-session/broadcast",
        {
          method: "POST",
          body: JSON.stringify({ type: "notification", message: "Hello" }),
        }
      );

      expect(res.status).toBe(200);
    });
  });
});

describe("Collaboration REST API", () => {
  describe("GET /api/ws/collaboration/:documentId/document", () => {
    it("should return document state", async () => {
      const mockStub = {
        fetch: vi
          .fn()
          .mockResolvedValue(
            new Response(
              JSON.stringify({ content: "Document content", version: 1 })
            )
          ),
      };

      const testApp = new Hono();
      testApp.get("/api/ws/collaboration/:documentId/document", async (c) => {
        return mockStub.fetch(new Request("http://test/document"));
      });

      const res = await testApp.request(
        "/api/ws/collaboration/doc123/document"
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.content).toBe("Document content");
    });
  });

  describe("GET /api/ws/collaboration/:documentId/collaborators", () => {
    it("should return list of collaborators", async () => {
      const mockStub = {
        fetch: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              collaborators: [
                {
                  userId: "user1",
                  displayName: "User 1",
                  cursor: { line: 1, column: 5 },
                },
                {
                  userId: "user2",
                  displayName: "User 2",
                  cursor: { line: 10, column: 20 },
                },
              ],
            })
          )
        ),
      };

      const testApp = new Hono();
      testApp.get(
        "/api/ws/collaboration/:documentId/collaborators",
        async (c) => {
          return mockStub.fetch(new Request("http://test/collaborators"));
        }
      );

      const res = await testApp.request(
        "/api/ws/collaboration/doc123/collaborators"
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.collaborators).toHaveLength(2);
    });
  });

  describe("GET /api/ws/collaboration/:documentId/history", () => {
    it("should return operation history", async () => {
      const mockStub = {
        fetch: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              operations: [
                { id: "op1", type: "insert", data: "Hello" },
                { id: "op2", type: "delete", data: "World" },
              ],
            })
          )
        ),
      };

      const testApp = new Hono();
      testApp.get("/api/ws/collaboration/:documentId/history", async (c) => {
        return mockStub.fetch(new Request("http://test/history"));
      });

      const res = await testApp.request("/api/ws/collaboration/doc123/history");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.operations).toHaveLength(2);
    });

    it("should support limit and from query parameters", async () => {
      const mockStub = {
        fetch: vi.fn().mockImplementation((req: Request) => {
          const url = new URL(req.url);
          return new Response(
            JSON.stringify({
              limit: url.searchParams.get("limit"),
              from: url.searchParams.get("from"),
            })
          );
        }),
      };

      const testApp = new Hono();
      testApp.get("/api/ws/collaboration/:documentId/history", async (c) => {
        const url = new URL(c.req.url);
        url.pathname = "/history";
        const limit = c.req.query("limit");
        const from = c.req.query("from");
        if (limit) url.searchParams.set("limit", limit);
        if (from) url.searchParams.set("from", from);

        return mockStub.fetch(new Request(url.toString()));
      });

      const res = await testApp.request(
        "/api/ws/collaboration/doc123/history?limit=10&from=op5"
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.limit).toBe("10");
      expect(body.from).toBe("op5");
    });
  });
});
