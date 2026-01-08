/**
 * @file github.test.ts
 * @description GitHub routes 单元测试
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock GitHub service
vi.mock("../services/github", () => ({
  createGitHubAppService: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  GitHubAppError: class GitHubAppError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
      this.name = "GitHubAppError";
    }
  },
}));

import {
  createGitHubAppService,
  GitHubAppError,
  verifyWebhookSignature,
} from "../services/github";
import githubRoutes from "./github";

const mockCreateGitHubAppService = createGitHubAppService as ReturnType<
  typeof vi.fn
>;
const mockVerifyWebhookSignature = verifyWebhookSignature as ReturnType<
  typeof vi.fn
>;

// Test app setup with env bindings
function createTestApp() {
  const app = new Hono<{
    Bindings: { GITHUB_WEBHOOK_SECRET: string; GITHUB_APP_SLUG: string };
  }>();

  // Set env variables
  app.use("*", async (c, next) => {
    c.env = {
      GITHUB_WEBHOOK_SECRET: "test-secret",
      GITHUB_APP_SLUG: "test-app",
    } as any;
    await next();
  });

  app.route("/api/github", githubRoutes);
  return app;
}

function createTestAppWithoutConfig() {
  const app = new Hono<{
    Bindings: { GITHUB_WEBHOOK_SECRET?: string; GITHUB_APP_SLUG?: string };
  }>();

  app.use("*", async (c, next) => {
    c.env = {} as any;
    await next();
  });

  app.route("/api/github", githubRoutes);
  return app;
}

describe("GitHub Routes", () => {
  let mockGitHub: {
    listInstallationRepos: ReturnType<typeof vi.fn>;
    getPrDetails: ReturnType<typeof vi.fn>;
    postPrComment: ReturnType<typeof vi.fn>;
    createPr: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGitHub = {
      listInstallationRepos: vi.fn(),
      getPrDetails: vi.fn(),
      postPrComment: vi.fn(),
      createPr: vi.fn(),
    };
    mockCreateGitHubAppService.mockReturnValue(mockGitHub);
  });

  describe("POST /api/github/webhook", () => {
    it("should return 500 when webhook secret not configured", async () => {
      const app = createTestAppWithoutConfig();

      const res = await app.request("/api/github/webhook", { method: "POST" });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Webhook not configured");
    });

    it("should return 401 when signature missing", async () => {
      const app = createTestApp();

      const res = await app.request("/api/github/webhook", {
        method: "POST",
        headers: { "X-GitHub-Event": "ping" },
        body: "{}",
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Missing signature");
    });

    it("should return 400 when event type missing", async () => {
      const app = createTestApp();

      const res = await app.request("/api/github/webhook", {
        method: "POST",
        headers: { "X-Hub-Signature-256": "sha256=test" },
        body: "{}",
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Missing event type");
    });

    it("should return 401 when signature invalid", async () => {
      const app = createTestApp();
      mockVerifyWebhookSignature.mockResolvedValueOnce(false);

      const res = await app.request("/api/github/webhook", {
        method: "POST",
        headers: {
          "X-Hub-Signature-256": "sha256=invalid",
          "X-GitHub-Event": "ping",
        },
        body: "{}",
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Invalid signature");
    });

    it("should return 400 for invalid JSON", async () => {
      const app = createTestApp();
      mockVerifyWebhookSignature.mockResolvedValueOnce(true);

      const res = await app.request("/api/github/webhook", {
        method: "POST",
        headers: {
          "X-Hub-Signature-256": "sha256=test",
          "X-GitHub-Event": "ping",
        },
        body: "not json",
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid JSON");
    });

    it("should handle ping event", async () => {
      const app = createTestApp();
      mockVerifyWebhookSignature.mockResolvedValueOnce(true);

      const res = await app.request("/api/github/webhook", {
        method: "POST",
        headers: {
          "X-Hub-Signature-256": "sha256=test",
          "X-GitHub-Event": "ping",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ zen: "test" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("pong");
    });

    it("should handle pull_request event", async () => {
      const app = createTestApp();
      mockVerifyWebhookSignature.mockResolvedValueOnce(true);

      const res = await app.request("/api/github/webhook", {
        method: "POST",
        headers: {
          "X-Hub-Signature-256": "sha256=test",
          "X-GitHub-Event": "pull_request",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "opened",
          pull_request: { number: 123 },
          repository: { full_name: "owner/repo" },
          installation: { id: 456 },
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("PR event processed");
      expect(json.action).toBe("opened");
      expect(json.pr).toBe(123);
    });

    it("should return 400 for pull_request without installation", async () => {
      const app = createTestApp();
      mockVerifyWebhookSignature.mockResolvedValueOnce(true);

      const res = await app.request("/api/github/webhook", {
        method: "POST",
        headers: {
          "X-Hub-Signature-256": "sha256=test",
          "X-GitHub-Event": "pull_request",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "opened",
          pull_request: { number: 123 },
          repository: { full_name: "owner/repo" },
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Missing installation");
    });

    it("should handle installation event", async () => {
      const app = createTestApp();
      mockVerifyWebhookSignature.mockResolvedValueOnce(true);

      const res = await app.request("/api/github/webhook", {
        method: "POST",
        headers: {
          "X-Hub-Signature-256": "sha256=test",
          "X-GitHub-Event": "installation",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "created",
          installation: { id: 456, account: { login: "test-org" } },
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Installation event processed");
      expect(json.account).toBe("test-org");
    });

    it("should handle push event", async () => {
      const app = createTestApp();
      mockVerifyWebhookSignature.mockResolvedValueOnce(true);

      const res = await app.request("/api/github/webhook", {
        method: "POST",
        headers: {
          "X-Hub-Signature-256": "sha256=test",
          "X-GitHub-Event": "push",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "refs/heads/main",
          commits: [{ id: "123" }, { id: "456" }],
          repository: { full_name: "owner/repo" },
          installation: { id: 789 },
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Push event processed");
      expect(json.commits).toBe(2);
    });

    it("should handle unknown event", async () => {
      const app = createTestApp();
      mockVerifyWebhookSignature.mockResolvedValueOnce(true);

      const res = await app.request("/api/github/webhook", {
        method: "POST",
        headers: {
          "X-Hub-Signature-256": "sha256=test",
          "X-GitHub-Event": "unknown_event",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Event received");
    });
  });

  describe("GET /api/github/installations", () => {
    it("should return empty installations list", async () => {
      const app = createTestApp();

      const res = await app.request("/api/github/installations");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.installations).toEqual([]);
    });
  });

  describe("GET /api/github/installations/:installationId/repos", () => {
    it("should return installation repos", async () => {
      const app = createTestApp();
      const mockRepos = [
        { id: 1, name: "repo1" },
        { id: 2, name: "repo2" },
      ];
      mockGitHub.listInstallationRepos.mockResolvedValueOnce(mockRepos);

      const res = await app.request("/api/github/installations/123/repos");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.repositories).toEqual(mockRepos);
    });

    it("should return 400 for invalid installation ID", async () => {
      const app = createTestApp();

      const res = await app.request("/api/github/installations/invalid/repos");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid ID");
    });

    it("should handle GitHubAppError", async () => {
      const app = createTestApp();
      mockGitHub.listInstallationRepos.mockRejectedValueOnce(
        new GitHubAppError("Not found", 404)
      );

      const res = await app.request("/api/github/installations/123/repos");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Not found");
    });

    it("should handle unknown error", async () => {
      const app = createTestApp();
      mockGitHub.listInstallationRepos.mockRejectedValueOnce(
        new Error("Unknown")
      );

      const res = await app.request("/api/github/installations/123/repos");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Unknown error");
    });
  });

  describe("GET /api/github/repos/:owner/:repo/pulls/:prNumber", () => {
    it("should return PR details", async () => {
      const app = createTestApp();
      const mockPr = { number: 123, title: "Test PR" };
      mockGitHub.getPrDetails.mockResolvedValueOnce(mockPr);

      const res = await app.request(
        "/api/github/repos/owner/repo/pulls/123?installation_id=456"
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockPr);
    });

    it("should return 400 for missing installation_id", async () => {
      const app = createTestApp();

      const res = await app.request("/api/github/repos/owner/repo/pulls/123");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid parameters");
    });

    it("should return 400 for invalid PR number", async () => {
      const app = createTestApp();

      const res = await app.request(
        "/api/github/repos/owner/repo/pulls/invalid?installation_id=456"
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid parameters");
    });

    it("should handle GitHubAppError", async () => {
      const app = createTestApp();
      mockGitHub.getPrDetails.mockRejectedValueOnce(
        new GitHubAppError("PR not found", 404)
      );

      const res = await app.request(
        "/api/github/repos/owner/repo/pulls/123?installation_id=456"
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("PR not found");
    });
  });

  describe("POST /api/github/repos/:owner/:repo/pulls/:prNumber/comments", () => {
    it("should post PR comment", async () => {
      const app = createTestApp();
      mockGitHub.postPrComment.mockResolvedValueOnce(undefined);

      const res = await app.request(
        "/api/github/repos/owner/repo/pulls/123/comments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: "Test comment", installation_id: 456 }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Comment posted");
    });

    it("should return 400 for invalid PR number", async () => {
      const app = createTestApp();

      const res = await app.request(
        "/api/github/repos/owner/repo/pulls/invalid/comments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: "Test", installation_id: 456 }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid params");
    });

    it("should return 400 for invalid body", async () => {
      const app = createTestApp();

      const res = await app.request(
        "/api/github/repos/owner/repo/pulls/123/comments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invalid: "data" }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid body");
    });

    it("should handle GitHubAppError", async () => {
      const app = createTestApp();
      mockGitHub.postPrComment.mockRejectedValueOnce(
        new GitHubAppError("Forbidden", 403)
      );

      const res = await app.request(
        "/api/github/repos/owner/repo/pulls/123/comments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: "Test", installation_id: 456 }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/github/repos/:owner/:repo/pulls", () => {
    it("should create PR", async () => {
      const app = createTestApp();
      const mockPr = { number: 123, title: "New PR" };
      mockGitHub.createPr.mockResolvedValueOnce(mockPr);

      const res = await app.request("/api/github/repos/owner/repo/pulls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New PR",
          head: "feature-branch",
          base: "main",
          installation_id: 456,
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json).toEqual(mockPr);
    });

    it("should return 400 for invalid body", async () => {
      const app = createTestApp();

      const res = await app.request("/api/github/repos/owner/repo/pulls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "No head or base" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid body");
    });

    it("should handle GitHubAppError", async () => {
      const app = createTestApp();
      mockGitHub.createPr.mockRejectedValueOnce(
        new GitHubAppError("Validation error", 422)
      );

      const res = await app.request("/api/github/repos/owner/repo/pulls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "PR",
          head: "feature",
          base: "main",
          installation_id: 456,
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(422);
    });
  });

  describe("GET /api/github/install-url", () => {
    it("should return installation URL", async () => {
      const app = createTestApp();

      const res = await app.request("/api/github/install-url");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.url).toBe(
        "https://github.com/apps/test-app/installations/new"
      );
    });

    it("should return 500 when app slug not configured", async () => {
      const app = createTestAppWithoutConfig();

      const res = await app.request("/api/github/install-url");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Not configured");
    });
  });
});

describe("GitHub Validation Schemas", () => {
  const commentSchema = z.object({
    body: z.string().min(1),
    installation_id: z.number(),
  });

  const createPrSchema = z.object({
    title: z.string().min(1),
    body: z.string().optional().default(""),
    head: z.string().min(1),
    base: z.string().min(1),
    installation_id: z.number(),
  });

  describe("commentSchema", () => {
    it("should accept valid comment", () => {
      const result = commentSchema.safeParse({
        body: "Test comment",
        installation_id: 123,
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty body", () => {
      const result = commentSchema.safeParse({
        body: "",
        installation_id: 123,
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing installation_id", () => {
      const result = commentSchema.safeParse({
        body: "Test",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createPrSchema", () => {
    it("should accept valid PR data", () => {
      const result = createPrSchema.safeParse({
        title: "New PR",
        head: "feature",
        base: "main",
        installation_id: 123,
      });
      expect(result.success).toBe(true);
    });

    it("should default body to empty string", () => {
      const result = createPrSchema.safeParse({
        title: "New PR",
        head: "feature",
        base: "main",
        installation_id: 123,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body).toBe("");
      }
    });

    it("should reject missing required fields", () => {
      const result = createPrSchema.safeParse({
        title: "New PR",
      });
      expect(result.success).toBe(false);
    });
  });
});
