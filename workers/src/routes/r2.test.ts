/**
 * @file r2.test.ts
 * @description R2 routes 单元测试
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock R2 service
vi.mock("../services/r2", () => ({
  createR2Service: vi.fn(),
  getContentType: vi.fn((filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = {
      txt: "text/plain",
      json: "application/json",
      png: "image/png",
    };
    return types[ext || ""] || "application/octet-stream";
  }),
}));

import { createR2Service } from "../services/r2";
import r2Routes from "./r2";

const mockCreateR2Service = createR2Service as ReturnType<typeof vi.fn>;

// Test app setup
function createTestApp() {
  const app = new Hono();
  app.route("/api/r2", r2Routes);
  return app;
}

describe("R2 Routes", () => {
  let mockR2: {
    upload: ReturnType<typeof vi.fn>;
    getStream: ReturnType<typeof vi.fn>;
    getMetadata: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockR2 = {
      upload: vi.fn(),
      getStream: vi.fn(),
      getMetadata: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      list: vi.fn(),
    };
    mockCreateR2Service.mockReturnValue(mockR2);
  });

  describe("POST /api/r2/upload/:key", () => {
    it("should upload file successfully", async () => {
      const app = createTestApp();
      const uploadResult = {
        key: "test-file.txt",
        size: 13,
        etag: '"abc123"',
        uploaded: new Date("2024-01-01"),
      };

      mockR2.upload.mockResolvedValueOnce(uploadResult);

      const res = await app.request("/api/r2/upload/test-file.txt", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "Hello, World!",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.key).toBe("test-file.txt");
      expect(json.data.size).toBe(13);
      expect(json.data.etag).toBe('"abc123"');
    });

    it("should handle nested file paths", async () => {
      const app = createTestApp();
      const uploadResult = {
        key: "folder/subfolder/file.txt",
        size: 7,
        etag: '"def456"',
        uploaded: new Date("2024-01-01"),
      };

      mockR2.upload.mockResolvedValueOnce(uploadResult);

      const res = await app.request(
        "/api/r2/upload/folder/subfolder/file.txt",
        {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "content",
        }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it("should return 500 on upload error", async () => {
      const app = createTestApp();
      mockR2.upload.mockRejectedValueOnce(new Error("R2 upload failed"));

      const res = await app.request("/api/r2/upload/test.txt", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "content",
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Upload failed");
    });
  });

  describe("GET /api/r2/download/:key", () => {
    it("should download file successfully", async () => {
      const app = createTestApp();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("file content"));
          controller.close();
        },
      });

      mockR2.getStream.mockResolvedValueOnce({
        body: stream,
        metadata: {
          contentType: "text/plain",
          size: 12,
          etag: '"abc123"',
        },
      });

      const res = await app.request("/api/r2/download/test.txt");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/plain");
      expect(res.headers.get("Content-Length")).toBe("12");
    });

    it("should handle nested file paths", async () => {
      const app = createTestApp();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("content"));
          controller.close();
        },
      });

      mockR2.getStream.mockResolvedValueOnce({
        body: stream,
        metadata: {
          contentType: "application/json",
          size: 7,
          etag: '"def"',
        },
      });

      const res = await app.request("/api/r2/download/folder/data.json");

      expect(res.status).toBe(200);
      expect(mockR2.getStream).toHaveBeenCalledWith("folder/data.json");
    });

    it("should return 404 for non-existent file", async () => {
      const app = createTestApp();
      mockR2.getStream.mockResolvedValueOnce(null);

      const res = await app.request("/api/r2/download/missing.txt");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Not Found");
    });

    it("should return 500 on download error", async () => {
      const app = createTestApp();
      mockR2.getStream.mockRejectedValueOnce(new Error("R2 error"));

      const res = await app.request("/api/r2/download/test.txt");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Download failed");
    });

    it("should use default content type when not specified", async () => {
      const app = createTestApp();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("binary"));
          controller.close();
        },
      });

      mockR2.getStream.mockResolvedValueOnce({
        body: stream,
        metadata: {
          contentType: null,
          size: 6,
          etag: '"xyz"',
        },
      });

      const res = await app.request("/api/r2/download/file.bin");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    });
  });

  describe("DELETE /api/r2/delete/:key", () => {
    it("should delete file successfully", async () => {
      const app = createTestApp();
      mockR2.delete.mockResolvedValueOnce(undefined);

      const res = await app.request("/api/r2/delete/test.txt", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('File "test.txt" deleted');
    });

    it("should handle nested file paths", async () => {
      const app = createTestApp();
      mockR2.delete.mockResolvedValueOnce(undefined);

      const res = await app.request("/api/r2/delete/folder/file.txt", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe('File "folder/file.txt" deleted');
    });

    it("should return 500 on delete error", async () => {
      const app = createTestApp();
      mockR2.delete.mockRejectedValueOnce(new Error("R2 delete failed"));

      const res = await app.request("/api/r2/delete/test.txt", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Delete failed");
    });
  });

  describe("POST /api/r2/delete-batch", () => {
    it("should delete multiple files", async () => {
      const app = createTestApp();
      mockR2.deleteMany.mockResolvedValueOnce(undefined);

      const res = await app.request("/api/r2/delete-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: ["file1.txt", "file2.txt", "file3.txt"] }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe("Deleted 3 files");
      expect(json.deleted).toEqual(["file1.txt", "file2.txt", "file3.txt"]);
    });

    it("should return 400 for empty keys array", async () => {
      const app = createTestApp();

      const res = await app.request("/api/r2/delete-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: [] }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for missing keys", async () => {
      const app = createTestApp();

      const res = await app.request("/api/r2/delete-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("should return 500 on batch delete error", async () => {
      const app = createTestApp();
      mockR2.deleteMany.mockRejectedValueOnce(new Error("Batch failed"));

      const res = await app.request("/api/r2/delete-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: ["file1.txt"] }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Batch delete failed");
    });
  });

  describe("GET /api/r2/list", () => {
    it("should list files", async () => {
      const app = createTestApp();
      const listResult = {
        objects: [
          { key: "file1.txt", size: 100 },
          { key: "file2.txt", size: 200 },
        ],
        truncated: false,
        cursor: null,
      };
      mockR2.list.mockResolvedValueOnce(listResult);

      const res = await app.request("/api/r2/list");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual(listResult);
    });

    it("should support prefix filter", async () => {
      const app = createTestApp();
      mockR2.list.mockResolvedValueOnce({ objects: [], truncated: false });

      const res = await app.request("/api/r2/list?prefix=images/");

      expect(res.status).toBe(200);
      expect(mockR2.list).toHaveBeenCalledWith({
        prefix: "images/",
        limit: 100,
        cursor: undefined,
      });
    });

    it("should support limit parameter", async () => {
      const app = createTestApp();
      mockR2.list.mockResolvedValueOnce({ objects: [], truncated: false });

      const res = await app.request("/api/r2/list?limit=50");

      expect(res.status).toBe(200);
      expect(mockR2.list).toHaveBeenCalledWith({
        prefix: undefined,
        limit: 50,
        cursor: undefined,
      });
    });

    it("should cap limit at 1000", async () => {
      const app = createTestApp();
      mockR2.list.mockResolvedValueOnce({ objects: [], truncated: false });

      const res = await app.request("/api/r2/list?limit=5000");

      expect(res.status).toBe(200);
      expect(mockR2.list).toHaveBeenCalledWith({
        prefix: undefined,
        limit: 1000,
        cursor: undefined,
      });
    });

    it("should support cursor for pagination", async () => {
      const app = createTestApp();
      mockR2.list.mockResolvedValueOnce({ objects: [], truncated: false });

      const res = await app.request("/api/r2/list?cursor=abc123");

      expect(res.status).toBe(200);
      expect(mockR2.list).toHaveBeenCalledWith({
        prefix: undefined,
        limit: 100,
        cursor: "abc123",
      });
    });

    it("should return 500 on list error", async () => {
      const app = createTestApp();
      mockR2.list.mockRejectedValueOnce(new Error("List failed"));

      const res = await app.request("/api/r2/list");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("List failed");
    });
  });

  describe("GET /api/r2/exists/:key", () => {
    it("should return true when file exists", async () => {
      const app = createTestApp();
      mockR2.exists.mockResolvedValueOnce(true);

      const res = await app.request("/api/r2/exists/test.txt");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.exists).toBe(true);
      expect(json.key).toBe("test.txt");
    });

    it("should return false when file does not exist", async () => {
      const app = createTestApp();
      mockR2.exists.mockResolvedValueOnce(false);

      const res = await app.request("/api/r2/exists/missing.txt");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.exists).toBe(false);
    });

    it("should handle nested file paths", async () => {
      const app = createTestApp();
      mockR2.exists.mockResolvedValueOnce(true);

      const res = await app.request("/api/r2/exists/folder/file.txt");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.key).toBe("folder/file.txt");
    });

    it("should return 500 on exists check error", async () => {
      const app = createTestApp();
      mockR2.exists.mockRejectedValueOnce(new Error("R2 error"));

      const res = await app.request("/api/r2/exists/test.txt");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Check failed");
    });
  });
});

describe("R2 Validation Schemas", () => {
  const deleteSchema = z.object({
    keys: z.array(z.string()).min(1).max(100),
  });

  describe("deleteSchema", () => {
    it("should accept valid keys array", () => {
      const result = deleteSchema.safeParse({
        keys: ["file1.txt", "file2.txt"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty keys array", () => {
      const result = deleteSchema.safeParse({
        keys: [],
      });
      expect(result.success).toBe(false);
    });

    it("should reject keys array exceeding max", () => {
      const result = deleteSchema.safeParse({
        keys: Array(101).fill("file.txt"),
      });
      expect(result.success).toBe(false);
    });

    it("should accept max 100 keys", () => {
      const result = deleteSchema.safeParse({
        keys: Array(100).fill("file.txt"),
      });
      expect(result.success).toBe(true);
    });
  });
});
