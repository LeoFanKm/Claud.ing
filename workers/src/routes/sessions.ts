/**
 * @file sessions.ts
 * @description Sessions API 路由 - 任务会话管理端点
 *
 * @input HTTP 请求 (GET/POST)
 * @output Session 数据响应
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
import { createDatabaseService, DatabaseError } from "../services/database";

// Session 类型定义
export interface Session {
  id: string;
  task_id: string;
  executor: string | null;
  name: string | null;
  status: SessionStatusType;
  created_at: string;
  updated_at: string;
}

// Session 状态枚举
export const SessionStatus = {
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type SessionStatusType =
  (typeof SessionStatus)[keyof typeof SessionStatus];

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

// 创建 Session 验证 Schema
const createSessionSchema = z.object({
  executor: z.string().max(100).optional().nullable(),
  name: z.string().max(255).optional().nullable(),
  status: z
    .enum(["active", "completed", "cancelled"])
    .optional()
    .default("active"),
});

// 更新 Session 验证 Schema
const updateSessionSchema = z.object({
  executor: z.string().max(100).optional().nullable(),
  name: z.string().max(255).optional().nullable(),
  status: z.enum(["active", "completed", "cancelled"]).optional(),
});

// UUID 验证辅助函数
function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// 任务会话路由 (挂载在 /api/tasks/:taskId/sessions)
export const taskSessionRoutes = new Hono<AuthBindings>();

// 应用认证中间件
taskSessionRoutes.use("*", authMiddleware);

// GET /api/tasks/:taskId/sessions - 获取任务的会话列表
taskSessionRoutes.get("/", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const taskId = c.req.param("taskId") as string;

  // 验证 UUID 格式
  if (!(taskId && isValidUUID(taskId))) {
    return c.json(errorResponse("Invalid task ID format"), 400);
  }

  // 查询参数
  const status = c.req.query("status") as SessionStatusType | undefined;
  const limit = Number.parseInt(c.req.query("limit") || "50", 10);
  const offset = Number.parseInt(c.req.query("offset") || "0", 10);

  try {
    // 验证任务存在
    const taskExists = await db.queryOne<{ id: string }>(
      "SELECT id FROM shared_tasks WHERE id = $1 AND deleted_at IS NULL",
      [taskId]
    );

    if (!taskExists) {
      return c.json(errorResponse("Task not found"), 404);
    }

    // 构建动态查询
    let query = "SELECT * FROM task_sessions WHERE task_id = $1";
    const params: unknown[] = [taskId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query<Session>(query, params);

    return c.json(successResponse(result.rows));
  } catch (error) {
    console.error("Failed to list sessions:", error);
    return c.json(errorResponse("Failed to list sessions"), 500);
  }
});

// POST /api/tasks/:taskId/sessions - 创建会话
taskSessionRoutes.post(
  "/",
  requireAuth,
  zValidator("json", createSessionSchema),
  async (c) => {
    const db = createDatabaseService(c);
    const taskId = c.req.param("taskId") as string;
    const payload = c.req.valid("json");

    // 验证 UUID 格式
    if (!(taskId && isValidUUID(taskId))) {
      return c.json(errorResponse("Invalid task ID format"), 400);
    }

    try {
      // 验证任务存在
      const taskExists = await db.queryOne<{ id: string }>(
        "SELECT id FROM shared_tasks WHERE id = $1 AND deleted_at IS NULL",
        [taskId]
      );

      if (!taskExists) {
        return c.json(errorResponse("Task not found"), 404);
      }

      const result = await db.queryOne<Session>(
        `INSERT INTO task_sessions (
          task_id,
          executor,
          name,
          status
        ) VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [taskId, payload.executor || null, payload.name || null, payload.status]
      );

      if (!result) {
        return c.json(errorResponse("Failed to create session"), 500);
      }

      return c.json(successResponse(result), 201);
    } catch (error) {
      console.error("Failed to create session:", error);

      if (error instanceof DatabaseError) {
        // 外键约束错误
        if (error.code === "23503") {
          return c.json(errorResponse("Task not found"), 404);
        }
      }

      return c.json(errorResponse("Failed to create session"), 500);
    }
  }
);

// 独立会话路由 (挂载在 /api/sessions)
export const sessionRoutes = new Hono<AuthBindings>();

// 应用认证中间件
sessionRoutes.use("*", authMiddleware);

// GET /api/sessions/:id - 获取会话详情
sessionRoutes.get("/:id", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const id = c.req.param("id");

  // 验证 UUID 格式
  if (!isValidUUID(id)) {
    return c.json(errorResponse("Invalid session ID format"), 400);
  }

  try {
    const result = await db.queryOne<Session>(
      "SELECT * FROM task_sessions WHERE id = $1",
      [id]
    );

    if (!result) {
      return c.json(errorResponse("Session not found"), 404);
    }

    return c.json(successResponse(result));
  } catch (error) {
    console.error("Failed to get session:", error);
    return c.json(errorResponse("Failed to get session"), 500);
  }
});

// PUT /api/sessions/:id - 更新会话
sessionRoutes.put(
  "/:id",
  requireAuth,
  zValidator("json", updateSessionSchema),
  async (c) => {
    const db = createDatabaseService(c);
    const id = c.req.param("id");
    const payload = c.req.valid("json");

    // 验证 UUID 格式
    if (!isValidUUID(id)) {
      return c.json(errorResponse("Invalid session ID format"), 400);
    }

    // 检查是否有更新内容
    if (
      payload.executor === undefined &&
      payload.name === undefined &&
      payload.status === undefined
    ) {
      return c.json(errorResponse("No fields to update"), 400);
    }

    try {
      // 构建动态更新语句
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (payload.executor !== undefined) {
        updates.push(`executor = $${paramIndex}`);
        params.push(payload.executor);
        paramIndex++;
      }

      if (payload.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(payload.name);
        paramIndex++;
      }

      if (payload.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(payload.status);
        paramIndex++;
      }

      params.push(id);

      const result = await db.queryOne<Session>(
        `UPDATE task_sessions
         SET ${updates.join(", ")}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING *`,
        params
      );

      if (!result) {
        return c.json(errorResponse("Session not found"), 404);
      }

      return c.json(successResponse(result));
    } catch (error) {
      console.error("Failed to update session:", error);
      return c.json(errorResponse("Failed to update session"), 500);
    }
  }
);

// DELETE /api/sessions/:id - 删除会话
sessionRoutes.delete("/:id", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const id = c.req.param("id");

  // 验证 UUID 格式
  if (!isValidUUID(id)) {
    return c.json(errorResponse("Invalid session ID format"), 400);
  }

  try {
    const result = await db.queryOne<{ id: string }>(
      "DELETE FROM task_sessions WHERE id = $1 RETURNING id",
      [id]
    );

    if (!result) {
      return c.json(errorResponse("Session not found"), 404);
    }

    return c.json(successResponse({ deleted: true, id }));
  } catch (error) {
    console.error("Failed to delete session:", error);
    return c.json(errorResponse("Failed to delete session"), 500);
  }
});

export default sessionRoutes;
