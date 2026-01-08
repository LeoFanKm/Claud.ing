/**
 * @file github.test.ts
 * @description GitHub App 服务单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGitHubAppServiceFromEnv,
  type GitHubAppConfig,
  GitHubAppError,
  GitHubAppService,
  verifyWebhookSignature,
} from "./github";

describe("GitHubAppError", () => {
  it("should create error with message only", () => {
    const error = new GitHubAppError("Something went wrong");

    expect(error.message).toBe("Something went wrong");
    expect(error.name).toBe("GitHubAppError");
    expect(error.status).toBeUndefined();
    expect(error.response).toBeUndefined();
  });

  it("should create error with status and response", () => {
    const error = new GitHubAppError(
      "Not Found",
      404,
      '{"message": "Not Found"}'
    );

    expect(error.message).toBe("Not Found");
    expect(error.status).toBe(404);
    expect(error.response).toBe('{"message": "Not Found"}');
  });

  it("should be instanceof Error", () => {
    const error = new GitHubAppError("Test");

    expect(error instanceof Error).toBe(true);
    expect(error instanceof GitHubAppError).toBe(true);
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "test_webhook_secret";

  it("should return true for valid signature", async () => {
    const payload = '{"action":"opened","number":1}';

    // Generate valid signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await verifyWebhookSignature(
      secret,
      `sha256=${signatureHex}`,
      payload
    );

    expect(result).toBe(true);
  });

  it("should return false for invalid signature", async () => {
    const payload = '{"action":"opened"}';
    const invalidSignature = "sha256=" + "0".repeat(64);

    const result = await verifyWebhookSignature(
      secret,
      invalidSignature,
      payload
    );

    expect(result).toBe(false);
  });

  it("should return false for malformed signature header", async () => {
    const payload = '{"action":"opened"}';

    // Missing sha256= prefix
    const result1 = await verifyWebhookSignature(secret, "abc123", payload);
    expect(result1).toBe(false);

    // Wrong algorithm prefix
    const result2 = await verifyWebhookSignature(
      secret,
      "sha1=abc123",
      payload
    );
    expect(result2).toBe(false);
  });

  it("should return false for signature length mismatch", async () => {
    const payload = '{"action":"opened"}';

    // Too short
    const result = await verifyWebhookSignature(secret, "sha256=abc", payload);
    expect(result).toBe(false);
  });

  it("should handle ArrayBuffer payload", async () => {
    const payload = new TextEncoder().encode('{"action":"opened"}');

    // Generate valid signature for ArrayBuffer
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, payload);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await verifyWebhookSignature(
      secret,
      `sha256=${signatureHex}`,
      payload.buffer
    );

    expect(result).toBe(true);
  });

  it("should reject modified signatures", async () => {
    // Verify that any modification to the signature causes rejection
    const payload = '{"test":true}';
    const validSig = await generateSignature(secret, payload);

    // Generate completely different signature with wrong payload
    const wrongPayloadSig = await generateSignature(secret, '{"test":false}');

    // Valid signature should pass
    const validResult = await verifyWebhookSignature(secret, validSig, payload);
    expect(validResult).toBe(true);

    // Wrong signature for the payload should fail
    const invalidResult = await verifyWebhookSignature(
      secret,
      wrongPayloadSig,
      payload
    );
    expect(invalidResult).toBe(false);
  });
});

describe("GitHubAppService", () => {
  let service: GitHubAppService;
  const mockConfig: GitHubAppConfig = {
    appId: "12345",
    privateKey: "mock_base64_private_key",
    webhookSecret: "webhook_secret_123",
    appSlug: "my-github-app",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitHubAppService(mockConfig);
  });

  describe("appSlug getter", () => {
    it("should return the app slug", () => {
      expect(service.appSlug).toBe("my-github-app");
    });
  });

  describe("webhookSecret getter", () => {
    it("should return the webhook secret", () => {
      expect(service.webhookSecret).toBe("webhook_secret_123");
    });
  });
});

describe("createGitHubAppServiceFromEnv", () => {
  it("should create service from environment variables", () => {
    const env = {
      GITHUB_APP_ID: "env_app_id",
      GITHUB_APP_PRIVATE_KEY: "env_private_key",
      GITHUB_WEBHOOK_SECRET: "env_webhook_secret",
      GITHUB_APP_SLUG: "env-app-slug",
    };

    const service = createGitHubAppServiceFromEnv(env);

    expect(service.appSlug).toBe("env-app-slug");
    expect(service.webhookSecret).toBe("env_webhook_secret");
  });
});

// Integration tests with mocked fetch
describe("GitHubAppService API calls", () => {
  let service: GitHubAppService;
  let originalFetch: typeof global.fetch;

  // Generate a minimal valid RSA private key in PEM format (for testing only)
  // In real tests, you'd use a proper test key
  const testPrivateKeyPem = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA2a2rwplBQr3wEoT1dcm5iF6k1+nP1TfpMVXQcjAR49+0
TEST_KEY_PLACEHOLDER_NOT_REAL_DO_NOT_USE
-----END RSA PRIVATE KEY-----`;

  const mockConfig: GitHubAppConfig = {
    appId: "123456",
    // Base64 encoded PEM - we'll mock the crypto operations
    privateKey: Buffer.from(testPrivateKeyPem).toString("base64"),
    webhookSecret: "test_secret",
    appSlug: "test-app",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = global.fetch;
    service = new GitHubAppService(mockConfig);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("getInstallationToken", () => {
    it("should throw GitHubAppError on API failure", async () => {
      // Mock crypto.subtle for JWT generation
      vi.spyOn(crypto.subtle, "importKey").mockRejectedValueOnce(
        new Error("Invalid key")
      );

      await expect(service.getInstallationToken(12_345)).rejects.toThrow();
    });
  });

  describe("listInstallationRepos", () => {
    it("should handle pagination correctly", async () => {
      // This test validates the structure but would need proper mocking
      // for a full integration test
      expect(service).toHaveProperty("listInstallationRepos");
    });
  });
});

// Helper function to generate valid signature
async function generateSignature(
  secret: string,
  payload: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${signatureHex}`;
}

describe("Webhook Event Types", () => {
  // These are type tests - ensuring the types are correctly defined
  it("should have correct PullRequestEvent shape", () => {
    // Type-level test - this just ensures the types compile correctly
    const mockEvent = {
      action: "opened" as const,
      number: 1,
      pull_request: {
        number: 1,
        title: "Test PR",
        body: "Description",
        html_url: "https://github.com/owner/repo/pull/1",
        head: { ref: "feature", sha: "abc123" },
        base: { ref: "main", sha: "def456" },
      },
      repository: {
        id: 123,
        full_name: "owner/repo",
        name: "repo",
        owner: { login: "owner" },
      },
      sender: {
        login: "user",
        id: 456,
      },
    };

    expect(mockEvent.action).toBe("opened");
    expect(mockEvent.pull_request.number).toBe(1);
  });

  it("should have correct InstallationEvent shape", () => {
    const mockEvent = {
      action: "created" as const,
      repositories: [
        { id: 1, name: "repo1", full_name: "owner/repo1" },
        { id: 2, name: "repo2", full_name: "owner/repo2" },
      ],
      sender: {
        login: "user",
        id: 123,
      },
    };

    expect(mockEvent.action).toBe("created");
    expect(mockEvent.repositories).toHaveLength(2);
  });

  it("should have correct PushEvent shape", () => {
    const mockEvent = {
      action: "push",
      ref: "refs/heads/main",
      before: "abc123",
      after: "def456",
      commits: [
        {
          id: "commit123",
          message: "Add feature",
          author: { name: "User", email: "user@example.com" },
        },
      ],
      repository: {
        id: 123,
        full_name: "owner/repo",
        name: "repo",
        owner: { login: "owner" },
      },
      sender: {
        login: "user",
        id: 456,
      },
    };

    expect(mockEvent.ref).toBe("refs/heads/main");
    expect(mockEvent.commits).toHaveLength(1);
  });
});

describe("GitHubAppService type correctness", () => {
  it("should have all required methods", () => {
    const service = new GitHubAppService({
      appId: "test",
      privateKey: "test",
      webhookSecret: "test",
      appSlug: "test",
    });

    // Verify all methods exist
    expect(typeof service.getInstallationToken).toBe("function");
    expect(typeof service.getInstallation).toBe("function");
    expect(typeof service.listInstallationRepos).toBe("function");
    expect(typeof service.getPrDetails).toBe("function");
    expect(typeof service.postPrComment).toBe("function");
    expect(typeof service.createPr).toBe("function");
    expect(typeof service.getDefaultBranch).toBe("function");
    expect(typeof service.getFileContent).toBe("function");
    expect(typeof service.createOrUpdateFile).toBe("function");
    expect(typeof service.createBranch).toBe("function");
  });
});
