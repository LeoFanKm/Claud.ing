/**
 * @file settings.ts
 * @description Settings API 路由 - 用户设置读写端点
 *
 * @input HTTP 请求 (GET/PUT)
 * @output UserSettings 数据响应
 * @position workers/src/routes (路由层)
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  type AuthBindings,
  authMiddleware,
  requireAuth,
} from "../middleware/auth";
import { createDatabaseService } from "../services/database";

// UserSettings 类型定义
export interface UserSettings {
  id: string;
  user_id: string;
  theme: "LIGHT" | "DARK" | "SYSTEM";
  language: string;
  notifications: {
    sound_enabled: boolean;
    push_enabled: boolean;
  };
  analytics_enabled: boolean;
  pr_auto_description_enabled: boolean;
  pr_auto_description_prompt: string | null;
  git_branch_prefix: string;
  created_at: string;
  updated_at: string;
}

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

// 验证 Schema
const updateSettingsSchema = z.object({
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
  language: z.string().min(1).max(10).optional(),
  notifications: z
    .object({
      sound_enabled: z.boolean(),
      push_enabled: z.boolean(),
    })
    .optional(),
  analytics_enabled: z.boolean().optional(),
  pr_auto_description_enabled: z.boolean().optional(),
  pr_auto_description_prompt: z.string().max(2000).nullable().optional(),
  git_branch_prefix: z.string().max(50).optional(),
});

const settingsRoutes = new Hono<AuthBindings>();

// 应用认证中间件
settingsRoutes.use("*", authMiddleware);

// GET /api/settings - 获取当前用户设置
settingsRoutes.get("/", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const userId = c.get("userId");

  if (!userId) {
    return c.json(errorResponse("User not authenticated"), 401);
  }

  try {
    // 尝试获取现有设置
    let settings = await db.queryOne<UserSettings>(
      "SELECT * FROM user_settings WHERE user_id = $1",
      [userId]
    );

    // 如果设置不存在，创建默认设置
    if (!settings) {
      settings = await db.queryOne<UserSettings>(
        `INSERT INTO user_settings (user_id, theme, language, notifications, analytics_enabled, pr_auto_description_enabled, pr_auto_description_prompt, git_branch_prefix)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          "SYSTEM",
          "EN",
          JSON.stringify({ sound_enabled: true, push_enabled: false }),
          false,
          false,
          null,
          "",
        ]
      );
    }

    return c.json(successResponse(settings));
  } catch (error) {
    console.error("Failed to get settings:", error);
    return c.json(errorResponse("Failed to get settings"), 500);
  }
});

// PUT /api/settings - 更新当前用户设置
settingsRoutes.put(
  "/",
  requireAuth,
  zValidator("json", updateSettingsSchema),
  async (c) => {
    const db = createDatabaseService(c);
    const userId = c.get("userId");
    const payload = c.req.valid("json");

    if (!userId) {
      return c.json(errorResponse("User not authenticated"), 401);
    }

    // 检查是否有更新内容
    if (Object.keys(payload).length === 0) {
      return c.json(errorResponse("No fields to update"), 400);
    }

    try {
      // 构建动态更新语句
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (payload.theme !== undefined) {
        updates.push(`theme = $${paramIndex}`);
        params.push(payload.theme);
        paramIndex++;
      }

      if (payload.language !== undefined) {
        updates.push(`language = $${paramIndex}`);
        params.push(payload.language);
        paramIndex++;
      }

      if (payload.notifications !== undefined) {
        updates.push(`notifications = $${paramIndex}`);
        params.push(JSON.stringify(payload.notifications));
        paramIndex++;
      }

      if (payload.analytics_enabled !== undefined) {
        updates.push(`analytics_enabled = $${paramIndex}`);
        params.push(payload.analytics_enabled);
        paramIndex++;
      }

      if (payload.pr_auto_description_enabled !== undefined) {
        updates.push(`pr_auto_description_enabled = $${paramIndex}`);
        params.push(payload.pr_auto_description_enabled);
        paramIndex++;
      }

      if (payload.pr_auto_description_prompt !== undefined) {
        updates.push(`pr_auto_description_prompt = $${paramIndex}`);
        params.push(payload.pr_auto_description_prompt);
        paramIndex++;
      }

      if (payload.git_branch_prefix !== undefined) {
        updates.push(`git_branch_prefix = $${paramIndex}`);
        params.push(payload.git_branch_prefix);
        paramIndex++;
      }

      // 添加 updated_at
      updates.push("updated_at = NOW()");

      params.push(userId);

      // 使用 UPSERT 模式 - 如果不存在则插入，存在则更新
      const result = await db.queryOne<UserSettings>(
        `INSERT INTO user_settings (user_id, theme, language, notifications, analytics_enabled, pr_auto_description_enabled, pr_auto_description_prompt, git_branch_prefix)
         VALUES ($${paramIndex}, 'SYSTEM', 'EN', '{"sound_enabled":true,"push_enabled":false}', false, false, null, '')
         ON CONFLICT (user_id) DO UPDATE
         SET ${updates.join(", ")}
         RETURNING *`,
        params
      );

      if (!result) {
        return c.json(errorResponse("Failed to update settings"), 500);
      }

      return c.json(successResponse(result));
    } catch (error) {
      console.error("Failed to update settings:", error);
      return c.json(errorResponse("Failed to update settings"), 500);
    }
  }
);

export default settingsRoutes;
