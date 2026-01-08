/**
 * @file r2.ts
 * @description R2 存储 API 路由 - 文件上传、下载、删除端点
 *
 * @input HTTP 请求
 * @output 文件操作响应
 * @position workers/src/routes (路由层)
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Bindings } from "../index";
import { createR2Service, getContentType } from "../services/r2";

const r2Routes = new Hono<{ Bindings: Bindings }>();

// 上传文件
r2Routes.post("/upload/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const r2 = createR2Service(c);

  try {
    const contentType = c.req.header("Content-Type") || getContentType(key);
    const body = await c.req.arrayBuffer();

    const result = await r2.upload(key, body, {
      contentType,
      customMetadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json(
      {
        success: false,
        error: "Upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// 下载文件
r2Routes.get("/download/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const r2 = createR2Service(c);

  try {
    const result = await r2.getStream(key);

    if (!result) {
      return c.json(
        {
          success: false,
          error: "Not Found",
          message: `File "${key}" not found`,
        },
        404
      );
    }

    return new Response(result.body, {
      headers: {
        "Content-Type":
          result.metadata.contentType || "application/octet-stream",
        "Content-Length": result.metadata.size.toString(),
        ETag: result.metadata.etag,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return c.json(
      {
        success: false,
        error: "Download failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// 获取文件元数据
r2Routes.on("HEAD", "/download/:key{.+}", async (c) => {
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
    return c.body(null, 500);
  }
});

// 删除文件
r2Routes.delete("/delete/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const r2 = createR2Service(c);

  try {
    await r2.delete(key);

    return c.json({
      success: true,
      message: `File "${key}" deleted`,
    });
  } catch (error) {
    console.error("Delete error:", error);
    return c.json(
      {
        success: false,
        error: "Delete failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// 批量删除
const deleteSchema = z.object({
  keys: z.array(z.string()).min(1).max(100),
});

r2Routes.post("/delete-batch", zValidator("json", deleteSchema), async (c) => {
  const { keys } = c.req.valid("json");
  const r2 = createR2Service(c);

  try {
    await r2.deleteMany(keys);

    return c.json({
      success: true,
      message: `Deleted ${keys.length} files`,
      deleted: keys,
    });
  } catch (error) {
    console.error("Batch delete error:", error);
    return c.json(
      {
        success: false,
        error: "Batch delete failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// 列出文件
r2Routes.get("/list", async (c) => {
  const r2 = createR2Service(c);
  const prefix = c.req.query("prefix");
  const limit = Number.parseInt(c.req.query("limit") || "100", 10);
  const cursor = c.req.query("cursor");

  try {
    const result = await r2.list({
      prefix: prefix || undefined,
      limit: Math.min(limit, 1000),
      cursor: cursor || undefined,
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("List error:", error);
    return c.json(
      {
        success: false,
        error: "List failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// 检查文件是否存在
r2Routes.get("/exists/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const r2 = createR2Service(c);

  try {
    const exists = await r2.exists(key);

    return c.json({
      success: true,
      exists,
      key,
    });
  } catch (error) {
    console.error("Exists check error:", error);
    return c.json(
      {
        success: false,
        error: "Check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

export default r2Routes;
