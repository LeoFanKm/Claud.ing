/**
 * @file r2.ts
 * @description Cloudflare R2 存储服务 - 文件上传、下载、删除
 *
 * @input R2Bucket 绑定
 * @output 文件操作结果
 * @position workers/src/services (存储服务层)
 */

import type { Context } from "hono";

// 文件元数据类型
export interface FileMetadata {
  key: string;
  size: number;
  uploaded: Date;
  etag: string;
  contentType?: string;
  customMetadata?: Record<string, string>;
}

// 上传选项
export interface UploadOptions {
  contentType?: string;
  customMetadata?: Record<string, string>;
}

// 上传结果
export interface UploadResult {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
}

// 列表选项
export interface ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

// 列表结果
export interface ListResult {
  objects: FileMetadata[];
  truncated: boolean;
  cursor?: string;
}

/**
 * R2 存储服务类
 */
export class R2Service {
  constructor(private bucket: R2Bucket) {}

  /**
   * 上传文件
   * @param key 文件路径/键名
   * @param data 文件数据
   * @param options 上传选项
   */
  async upload(
    key: string,
    data: ArrayBuffer | ReadableStream | string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const httpMetadata: R2HTTPMetadata = {};

    if (options?.contentType) {
      httpMetadata.contentType = options.contentType;
    }

    const result = await this.bucket.put(key, data, {
      httpMetadata,
      customMetadata: options?.customMetadata,
    });

    return {
      key: result.key,
      size: result.size,
      etag: result.etag,
      uploaded: result.uploaded,
    };
  }

  /**
   * 下载文件
   * @param key 文件路径/键名
   * @returns 文件内容和元数据，不存在返回 null
   */
  async download(
    key: string
  ): Promise<{ data: ArrayBuffer; metadata: FileMetadata } | null> {
    const object = await this.bucket.get(key);

    if (!object) {
      return null;
    }

    const data = await object.arrayBuffer();

    return {
      data,
      metadata: {
        key: object.key,
        size: object.size,
        uploaded: object.uploaded,
        etag: object.etag,
        contentType: object.httpMetadata?.contentType,
        customMetadata: object.customMetadata,
      },
    };
  }

  /**
   * 获取文件流（用于大文件）
   * @param key 文件路径/键名
   */
  async getStream(
    key: string
  ): Promise<{ body: ReadableStream; metadata: FileMetadata } | null> {
    const object = await this.bucket.get(key);

    if (!object) {
      return null;
    }

    return {
      body: object.body,
      metadata: {
        key: object.key,
        size: object.size,
        uploaded: object.uploaded,
        etag: object.etag,
        contentType: object.httpMetadata?.contentType,
        customMetadata: object.customMetadata,
      },
    };
  }

  /**
   * 检查文件是否存在
   * @param key 文件路径/键名
   */
  async exists(key: string): Promise<boolean> {
    const head = await this.bucket.head(key);
    return head !== null;
  }

  /**
   * 获取文件元数据（不下载内容）
   * @param key 文件路径/键名
   */
  async getMetadata(key: string): Promise<FileMetadata | null> {
    const head = await this.bucket.head(key);

    if (!head) {
      return null;
    }

    return {
      key: head.key,
      size: head.size,
      uploaded: head.uploaded,
      etag: head.etag,
      contentType: head.httpMetadata?.contentType,
      customMetadata: head.customMetadata,
    };
  }

  /**
   * 删除文件
   * @param key 文件路径/键名
   */
  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  /**
   * 批量删除文件
   * @param keys 文件路径/键名数组
   */
  async deleteMany(keys: string[]): Promise<void> {
    await this.bucket.delete(keys);
  }

  /**
   * 列出文件
   * @param options 列表选项
   */
  async list(options?: ListOptions): Promise<ListResult> {
    const result = await this.bucket.list({
      prefix: options?.prefix,
      limit: options?.limit,
      cursor: options?.cursor,
    });

    return {
      objects: result.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        etag: obj.etag,
        contentType: obj.httpMetadata?.contentType,
        customMetadata: obj.customMetadata,
      })),
      truncated: result.truncated,
      cursor: result.truncated ? result.cursor : undefined,
    };
  }

  /**
   * 生成预签名 URL（用于直接客户端上传/下载）
   * 注意：R2 原生不支持预签名 URL，需要通过 Worker 代理
   * 这里返回一个代理路径
   */
  getProxyPath(key: string, action: "upload" | "download"): string {
    return `/api/r2/${action}/${encodeURIComponent(key)}`;
  }
}

/**
 * 从 Hono Context 创建 R2Service 实例
 * @param c - Hono Context，需要包含 R2_BUCKET 绑定
 */
export function createR2Service<
  T extends { Bindings: { R2_BUCKET: R2Bucket } },
>(c: Context<T>): R2Service {
  return new R2Service(c.env.R2_BUCKET);
}

/**
 * 根据文件扩展名推断 Content-Type
 */
export function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    // 图片
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",

    // 文档
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    // 文本
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    xml: "application/xml",
    md: "text/markdown",

    // 压缩
    zip: "application/zip",
    tar: "application/x-tar",
    gz: "application/gzip",

    // 音视频
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm",
  };

  return mimeTypes[ext || ""] || "application/octet-stream";
}
