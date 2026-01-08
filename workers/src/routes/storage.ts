/**
 * @file storage.ts
 * @description Storage API 路由 - 文件上传、下载、删除端点
 *
 * @input HTTP 请求
 * @output 文件操作响应
 * @position workers/src/routes (路由层)
 */

import { Hono } from "hono";
import {
  type AuthBindings,
  authMiddleware,
  requireAuth,
} from "../middleware/auth";
import { createR2Service, getContentType } from "../services/r2";

// API 响应包装器
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

const storageRoutes = new Hono<AuthBindings>();

// 应用认证中间件
storageRoutes.use("*", authMiddleware);

/**
 * POST /api/storage/upload - 上传文件
 *
 * 支持两种上传方式：
 * 1. Raw body: Content-Type 设置为文件类型，X-File-Key 指定存储路径
 * 2. Multipart form: 使用 file 字段上传，key 字段指定存储路径
 */
storageRoutes.post("/upload", requireAuth, async (c) => {
  const r2 = createR2Service(c);

  try {
    const contentType = c.req.header("Content-Type") || "";

    // 处理 multipart/form-data 上传
    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      const fileEntry = formData.get("file");
      let key = formData.get("key") as string | null;

      // 检查是否为 File 对象（Workers 环境使用属性检查而非 instanceof）
      if (!fileEntry || typeof fileEntry === "string") {
        return c.json(errorResponse("No file provided in form data"), 400);
      }

      // fileEntry 现在是 File 类型
      const file = fileEntry as File;

      // 如果没有指定 key，使用原始文件名
      if (!key) {
        key = file.name;
      }

      // 验证 key 非空
      if (!key || key.trim() === "") {
        return c.json(errorResponse("File key is required"), 400);
      }

      const buffer = await file.arrayBuffer();
      const fileContentType = file.type || getContentType(key);

      const result = await r2.upload(key, buffer, {
        contentType: fileContentType,
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      });

      return c.json(
        successResponse({
          key: result.key,
          size: result.size,
          etag: result.etag,
          uploaded: result.uploaded.toISOString(),
          contentType: fileContentType,
        }),
        201
      );
    }

    // 处理 raw body 上传
    const key = c.req.header("X-File-Key");
    if (!key) {
      return c.json(
        errorResponse("X-File-Key header is required for raw upload"),
        400
      );
    }

    const body = await c.req.arrayBuffer();
    if (body.byteLength === 0) {
      return c.json(errorResponse("Empty file body"), 400);
    }

    const fileContentType = contentType || getContentType(key);

    const result = await r2.upload(key, body, {
      contentType: fileContentType,
      customMetadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    return c.json(
      successResponse({
        key: result.key,
        size: result.size,
        etag: result.etag,
        uploaded: result.uploaded.toISOString(),
        contentType: fileContentType,
      }),
      201
    );
  } catch (error) {
    console.error("Upload error:", error);
    return c.json(
      errorResponse(error instanceof Error ? error.message : "Upload failed"),
      500
    );
  }
});

/**
 * GET /api/storage/:key - 下载文件
 *
 * 支持路径中包含 / 的 key，如 /api/storage/folder/subfolder/file.txt
 */
storageRoutes.get("/:key{.+}", requireAuth, async (c) => {
  const key = c.req.param("key");
  const r2 = createR2Service(c);

  try {
    const result = await r2.getStream(key);

    if (!result) {
      return c.json(errorResponse(`File "${key}" not found`), 404);
    }

    // 返回文件流
    return new Response(result.body, {
      headers: {
        "Content-Type":
          result.metadata.contentType || "application/octet-stream",
        "Content-Length": result.metadata.size.toString(),
        ETag: result.metadata.etag,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(key.split("/").pop() || key)}"`,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return c.json(
      errorResponse(error instanceof Error ? error.message : "Download failed"),
      500
    );
  }
});

/**
 * HEAD /api/storage/:key - 获取文件元数据
 */
storageRoutes.on("HEAD", "/:key{.+}", requireAuth, async (c) => {
  const key = c.req.param("key");
  const r2 = createR2Service(c);

  try {
    const metadata = await r2.getMetadata(key);

    if (!metadata) {
      return c.body(null, 404);
    }

    return c.body(null, 200, {
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Length": metadata.size.toString(),
      ETag: metadata.etag,
      "Last-Modified": metadata.uploaded.toUTCString(),
    });
  } catch (error) {
    console.error("Head error:", error);
    return c.body(null, 500);
  }
});

/**
 * DELETE /api/storage/:key - 删除文件
 */
storageRoutes.delete("/:key{.+}", requireAuth, async (c) => {
  const key = c.req.param("key");
  const r2 = createR2Service(c);

  try {
    // 先检查文件是否存在
    const exists = await r2.exists(key);
    if (!exists) {
      return c.json(errorResponse(`File "${key}" not found`), 404);
    }

    await r2.delete(key);

    return c.json(
      successResponse({
        deleted: true,
        key,
      })
    );
  } catch (error) {
    console.error("Delete error:", error);
    return c.json(
      errorResponse(error instanceof Error ? error.message : "Delete failed"),
      500
    );
  }
});

export default storageRoutes;
