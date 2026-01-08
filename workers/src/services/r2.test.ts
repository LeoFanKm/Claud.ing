/**
 * @file r2.test.ts
 * @description R2 存储服务单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContentType, R2Service } from "./r2";

// Create mock R2 bucket
function createMockR2Bucket(): R2Bucket {
  return {
    put: vi.fn(),
    get: vi.fn(),
    head: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  } as unknown as R2Bucket;
}

// Create mock R2 object
function createMockR2Object(overrides?: Partial<R2Object>): R2Object {
  const mockBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("test content"));
      controller.close();
    },
  });

  return {
    key: "test/file.txt",
    size: 12,
    etag: "abc123",
    uploaded: new Date("2024-01-01"),
    httpMetadata: { contentType: "text/plain" },
    customMetadata: { userId: "user_1" },
    body: mockBody,
    bodyUsed: false,
    arrayBuffer: vi
      .fn()
      .mockResolvedValue(new TextEncoder().encode("test content").buffer),
    text: vi.fn().mockResolvedValue("test content"),
    json: vi.fn(),
    blob: vi.fn(),
    writeHttpMetadata: vi.fn(),
    storageClass: "Standard",
    checksums: {},
    range: undefined,
    ...overrides,
  } as unknown as R2Object;
}

// Create mock R2ObjectBody for head results
function createMockR2ObjectBody(
  overrides?: Partial<R2ObjectBody>
): R2ObjectBody {
  return {
    key: "test/file.txt",
    size: 12,
    etag: "abc123",
    uploaded: new Date("2024-01-01"),
    httpMetadata: { contentType: "text/plain" },
    customMetadata: { userId: "user_1" },
    storageClass: "Standard",
    checksums: {},
    ...overrides,
  } as unknown as R2ObjectBody;
}

describe("R2Service", () => {
  let mockBucket: R2Bucket;
  let r2Service: R2Service;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBucket = createMockR2Bucket();
    r2Service = new R2Service(mockBucket);
  });

  describe("upload", () => {
    it("should upload file with default options", async () => {
      const uploadResult = {
        key: "uploads/file.txt",
        size: 100,
        etag: "xyz789",
        uploaded: new Date(),
      };

      (mockBucket.put as any).mockResolvedValueOnce(uploadResult);

      const result = await r2Service.upload("uploads/file.txt", "file content");

      expect(mockBucket.put).toHaveBeenCalledWith(
        "uploads/file.txt",
        "file content",
        { httpMetadata: {}, customMetadata: undefined }
      );
      expect(result.key).toBe("uploads/file.txt");
      expect(result.size).toBe(100);
      expect(result.etag).toBe("xyz789");
    });

    it("should upload file with content type", async () => {
      const uploadResult = {
        key: "images/photo.jpg",
        size: 5000,
        etag: "img123",
        uploaded: new Date(),
      };

      (mockBucket.put as any).mockResolvedValueOnce(uploadResult);

      await r2Service.upload("images/photo.jpg", new ArrayBuffer(5000), {
        contentType: "image/jpeg",
      });

      expect(mockBucket.put).toHaveBeenCalledWith(
        "images/photo.jpg",
        expect.any(ArrayBuffer),
        {
          httpMetadata: { contentType: "image/jpeg" },
          customMetadata: undefined,
        }
      );
    });

    it("should upload file with custom metadata", async () => {
      const uploadResult = {
        key: "docs/report.pdf",
        size: 10_000,
        etag: "pdf456",
        uploaded: new Date(),
      };

      (mockBucket.put as any).mockResolvedValueOnce(uploadResult);

      await r2Service.upload("docs/report.pdf", "pdf content", {
        contentType: "application/pdf",
        customMetadata: {
          uploadedBy: "user_123",
          department: "finance",
        },
      });

      expect(mockBucket.put).toHaveBeenCalledWith(
        "docs/report.pdf",
        "pdf content",
        {
          httpMetadata: { contentType: "application/pdf" },
          customMetadata: {
            uploadedBy: "user_123",
            department: "finance",
          },
        }
      );
    });

    it("should handle ArrayBuffer data", async () => {
      const buffer = new ArrayBuffer(8);
      const uploadResult = {
        key: "binary/data.bin",
        size: 8,
        etag: "bin789",
        uploaded: new Date(),
      };

      (mockBucket.put as any).mockResolvedValueOnce(uploadResult);

      const result = await r2Service.upload("binary/data.bin", buffer);

      expect(result.size).toBe(8);
    });
  });

  describe("download", () => {
    it("should download file and return data with metadata", async () => {
      const mockObject = createMockR2Object();
      (mockBucket.get as any).mockResolvedValueOnce(mockObject);

      const result = await r2Service.download("test/file.txt");

      expect(mockBucket.get).toHaveBeenCalledWith("test/file.txt");
      expect(result).not.toBeNull();
      expect(result!.metadata.key).toBe("test/file.txt");
      expect(result!.metadata.size).toBe(12);
      expect(result!.metadata.contentType).toBe("text/plain");
    });

    it("should return null when file not found", async () => {
      (mockBucket.get as any).mockResolvedValueOnce(null);

      const result = await r2Service.download("nonexistent/file.txt");

      expect(result).toBeNull();
    });

    it("should include custom metadata in result", async () => {
      const mockObject = createMockR2Object({
        customMetadata: { projectId: "proj_123", version: "2" },
      });
      (mockBucket.get as any).mockResolvedValueOnce(mockObject);

      const result = await r2Service.download("test/file.txt");

      expect(result!.metadata.customMetadata).toEqual({
        projectId: "proj_123",
        version: "2",
      });
    });
  });

  describe("getStream", () => {
    it("should return stream and metadata", async () => {
      const mockObject = createMockR2Object();
      (mockBucket.get as any).mockResolvedValueOnce(mockObject);

      const result = await r2Service.getStream("test/file.txt");

      expect(result).not.toBeNull();
      expect(result!.body).toBeInstanceOf(ReadableStream);
      expect(result!.metadata.key).toBe("test/file.txt");
    });

    it("should return null when file not found", async () => {
      (mockBucket.get as any).mockResolvedValueOnce(null);

      const result = await r2Service.getStream("nonexistent.txt");

      expect(result).toBeNull();
    });
  });

  describe("exists", () => {
    it("should return true when file exists", async () => {
      const mockHead = createMockR2ObjectBody();
      (mockBucket.head as any).mockResolvedValueOnce(mockHead);

      const result = await r2Service.exists("test/file.txt");

      expect(mockBucket.head).toHaveBeenCalledWith("test/file.txt");
      expect(result).toBe(true);
    });

    it("should return false when file does not exist", async () => {
      (mockBucket.head as any).mockResolvedValueOnce(null);

      const result = await r2Service.exists("nonexistent.txt");

      expect(result).toBe(false);
    });
  });

  describe("getMetadata", () => {
    it("should return metadata without downloading content", async () => {
      const mockHead = createMockR2ObjectBody({
        key: "docs/large-file.pdf",
        size: 1_000_000,
        etag: "large123",
        uploaded: new Date("2024-06-15"),
        httpMetadata: { contentType: "application/pdf" },
      });
      (mockBucket.head as any).mockResolvedValueOnce(mockHead);

      const result = await r2Service.getMetadata("docs/large-file.pdf");

      expect(result).not.toBeNull();
      expect(result!.key).toBe("docs/large-file.pdf");
      expect(result!.size).toBe(1_000_000);
      expect(result!.contentType).toBe("application/pdf");
    });

    it("should return null when file not found", async () => {
      (mockBucket.head as any).mockResolvedValueOnce(null);

      const result = await r2Service.getMetadata("missing.txt");

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete single file", async () => {
      (mockBucket.delete as any).mockResolvedValueOnce(undefined);

      await r2Service.delete("test/file.txt");

      expect(mockBucket.delete).toHaveBeenCalledWith("test/file.txt");
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple files", async () => {
      (mockBucket.delete as any).mockResolvedValueOnce(undefined);

      await r2Service.deleteMany([
        "test/file1.txt",
        "test/file2.txt",
        "test/file3.txt",
      ]);

      expect(mockBucket.delete).toHaveBeenCalledWith([
        "test/file1.txt",
        "test/file2.txt",
        "test/file3.txt",
      ]);
    });

    it("should handle empty array", async () => {
      (mockBucket.delete as any).mockResolvedValueOnce(undefined);

      await r2Service.deleteMany([]);

      expect(mockBucket.delete).toHaveBeenCalledWith([]);
    });
  });

  describe("list", () => {
    it("should list files with default options", async () => {
      const mockListResult = {
        objects: [
          createMockR2ObjectBody({ key: "file1.txt", size: 100 }),
          createMockR2ObjectBody({ key: "file2.txt", size: 200 }),
        ],
        truncated: false,
        cursor: undefined,
      };
      (mockBucket.list as any).mockResolvedValueOnce(mockListResult);

      const result = await r2Service.list();

      expect(mockBucket.list).toHaveBeenCalledWith({
        prefix: undefined,
        limit: undefined,
        cursor: undefined,
      });
      expect(result.objects).toHaveLength(2);
      expect(result.truncated).toBe(false);
    });

    it("should list files with prefix", async () => {
      const mockListResult = {
        objects: [createMockR2ObjectBody({ key: "images/photo.jpg" })],
        truncated: false,
      };
      (mockBucket.list as any).mockResolvedValueOnce(mockListResult);

      await r2Service.list({ prefix: "images/" });

      expect(mockBucket.list).toHaveBeenCalledWith({
        prefix: "images/",
        limit: undefined,
        cursor: undefined,
      });
    });

    it("should handle pagination", async () => {
      const mockListResult = {
        objects: Array(10).fill(createMockR2ObjectBody()),
        truncated: true,
        cursor: "next_page_cursor",
      };
      (mockBucket.list as any).mockResolvedValueOnce(mockListResult);

      const result = await r2Service.list({ limit: 10 });

      expect(result.truncated).toBe(true);
      expect(result.cursor).toBe("next_page_cursor");
    });

    it("should continue from cursor", async () => {
      const mockListResult = {
        objects: [],
        truncated: false,
      };
      (mockBucket.list as any).mockResolvedValueOnce(mockListResult);

      await r2Service.list({ cursor: "page_2_cursor" });

      expect(mockBucket.list).toHaveBeenCalledWith({
        prefix: undefined,
        limit: undefined,
        cursor: "page_2_cursor",
      });
    });

    it("should not include cursor when not truncated", async () => {
      const mockListResult = {
        objects: [createMockR2ObjectBody()],
        truncated: false,
        cursor: "should_be_ignored",
      };
      (mockBucket.list as any).mockResolvedValueOnce(mockListResult);

      const result = await r2Service.list();

      expect(result.cursor).toBeUndefined();
    });
  });

  describe("getProxyPath", () => {
    it("should generate upload proxy path", () => {
      const path = r2Service.getProxyPath("files/document.pdf", "upload");

      expect(path).toBe("/api/r2/upload/files%2Fdocument.pdf");
    });

    it("should generate download proxy path", () => {
      const path = r2Service.getProxyPath("images/photo.jpg", "download");

      expect(path).toBe("/api/r2/download/images%2Fphoto.jpg");
    });

    it("should handle special characters in key", () => {
      const path = r2Service.getProxyPath("files/my file (1).txt", "download");

      expect(path).toContain("my%20file");
    });
  });
});

describe("getContentType", () => {
  describe("image types", () => {
    it("should return correct MIME type for images", () => {
      expect(getContentType("photo.jpg")).toBe("image/jpeg");
      expect(getContentType("photo.jpeg")).toBe("image/jpeg");
      expect(getContentType("image.png")).toBe("image/png");
      expect(getContentType("animation.gif")).toBe("image/gif");
      expect(getContentType("modern.webp")).toBe("image/webp");
      expect(getContentType("vector.svg")).toBe("image/svg+xml");
      expect(getContentType("favicon.ico")).toBe("image/x-icon");
    });
  });

  describe("document types", () => {
    it("should return correct MIME type for documents", () => {
      expect(getContentType("document.pdf")).toBe("application/pdf");
      expect(getContentType("old.doc")).toBe("application/msword");
      expect(getContentType("new.docx")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(getContentType("old.xls")).toBe("application/vnd.ms-excel");
      expect(getContentType("new.xlsx")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });
  });

  describe("text types", () => {
    it("should return correct MIME type for text files", () => {
      expect(getContentType("readme.txt")).toBe("text/plain");
      expect(getContentType("page.html")).toBe("text/html");
      expect(getContentType("styles.css")).toBe("text/css");
      expect(getContentType("script.js")).toBe("application/javascript");
      expect(getContentType("data.json")).toBe("application/json");
      expect(getContentType("config.xml")).toBe("application/xml");
      expect(getContentType("README.md")).toBe("text/markdown");
    });
  });

  describe("archive types", () => {
    it("should return correct MIME type for archives", () => {
      expect(getContentType("archive.zip")).toBe("application/zip");
      expect(getContentType("backup.tar")).toBe("application/x-tar");
      expect(getContentType("compressed.gz")).toBe("application/gzip");
    });
  });

  describe("media types", () => {
    it("should return correct MIME type for audio/video", () => {
      expect(getContentType("song.mp3")).toBe("audio/mpeg");
      expect(getContentType("sound.wav")).toBe("audio/wav");
      expect(getContentType("video.mp4")).toBe("video/mp4");
      expect(getContentType("clip.webm")).toBe("video/webm");
    });
  });

  describe("edge cases", () => {
    it("should return octet-stream for unknown extensions", () => {
      expect(getContentType("file.unknown")).toBe("application/octet-stream");
      expect(getContentType("data.xyz")).toBe("application/octet-stream");
    });

    it("should return octet-stream for files without extension", () => {
      expect(getContentType("filename")).toBe("application/octet-stream");
    });

    it("should handle uppercase extensions", () => {
      expect(getContentType("photo.JPG")).toBe("image/jpeg");
      expect(getContentType("document.PDF")).toBe("application/pdf");
    });

    it("should handle files with multiple dots", () => {
      expect(getContentType("archive.2024.01.tar")).toBe("application/x-tar");
      expect(getContentType("file.backup.json")).toBe("application/json");
    });
  });
});
