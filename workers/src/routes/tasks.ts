/**
 * @file tasks.ts
 * @description Tasks API 路由 - CRUD 端点和状态管理
 *
 * @input HTTP 请求
 * @output Task 数据响应
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

// Task 状态枚举
export const TaskStatus = {
  TODO: "todo",
  IN_PROGRESS: "in-progress",
  IN_REVIEW: "in-review",
  DONE: "done",
  CANCELLED: "cancelled",
} as const;

export type TaskStatusType = (typeof TaskStatus)[keyof typeof TaskStatus];

// Task 类型定义
export interface Task {
  id: string;
  organization_id: string;
  project_id: string;
  creator_user_id: string | null;
  assignee_user_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatusType;
  version: number;
  deleted_at: string | null;
  shared_at: string | null;
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

// 状态枚举验证 Schema
const taskStatusSchema = z.enum([
  "todo",
  "in-progress",
  "in-review",
  "done",
  "cancelled",
]);

// 创建任务验证 Schema
const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10_000).optional().nullable(),
  status: taskStatusSchema.optional().default("todo"),
  assignee_user_id: z.string().uuid().optional().nullable(),
});

// 更新任务验证 Schema
const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10_000).optional().nullable(),
  status: taskStatusSchema.optional(),
  assignee_user_id: z.string().uuid().optional().nullable(),
});

// 状态变更验证 Schema
const updateStatusSchema = z.object({
  status: taskStatusSchema,
});

// 项目任务路由 (挂载在 /api/projects/:projectId/tasks)
export const projectTaskRoutes = new Hono<AuthBindings>();

// 应用认证中间件
projectTaskRoutes.use("*", authMiddleware);

// GET /api/projects/:projectId/tasks - 获取项目任务列表
projectTaskRoutes.get("/", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const projectId = c.req.param("projectId") as string;

  // 验证 UUID 格式
  if (!(projectId && isValidUUID(projectId))) {
    return c.json(errorResponse("Invalid project ID format"), 400);
  }

  // 查询参数
  const status = c.req.query("status") as TaskStatusType | undefined;
  const assigneeId = c.req.query("assignee_id");
  const includeDeleted = c.req.query("include_deleted") === "true";

  try {
    // 首先验证项目存在
    const projectExists = await db.queryOne<{ id: string }>(
      "SELECT id FROM projects WHERE id = $1",
      [projectId]
    );

    if (!projectExists) {
      return c.json(errorResponse("Project not found"), 404);
    }

    // 构建动态查询
    let query = "SELECT * FROM shared_tasks WHERE project_id = $1";
    const params: unknown[] = [projectId];
    let paramIndex = 2;

    if (!includeDeleted) {
      query += " AND deleted_at IS NULL";
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (assigneeId) {
      if (!isValidUUID(assigneeId)) {
        return c.json(errorResponse("Invalid assignee ID format"), 400);
      }
      query += ` AND assignee_user_id = $${paramIndex}`;
      params.push(assigneeId);
      paramIndex++;
    }

    query += " ORDER BY created_at DESC";

    const result = await db.query<Task>(query, params);

    return c.json(successResponse(result.rows));
  } catch (error) {
    console.error("Failed to list tasks:", error);
    return c.json(errorResponse("Failed to list tasks"), 500);
  }
});

// POST /api/projects/:projectId/tasks - 创建任务
projectTaskRoutes.post(
  "/",
  requireAuth,
  zValidator("json", createTaskSchema),
  async (c) => {
    const db = createDatabaseService(c);
    const projectId = c.req.param("projectId") as string;
    const payload = c.req.valid("json");

    // 验证 UUID 格式
    if (!(projectId && isValidUUID(projectId))) {
      return c.json(errorResponse("Invalid project ID format"), 400);
    }

    try {
      // 验证项目存在并获取 organization_id
      const project = await db.queryOne<{
        id: string;
        organization_id: string;
      }>("SELECT id, organization_id FROM projects WHERE id = $1", [projectId]);

      if (!project) {
        return c.json(errorResponse("Project not found"), 404);
      }

      // 获取当前用户 ID (从 auth context)
      const creatorUserId = c.get("userId");

      const result = await db.queryOne<Task>(
        `INSERT INTO shared_tasks (
          organization_id,
          project_id,
          creator_user_id,
          assignee_user_id,
          title,
          description,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          project.organization_id,
          projectId,
          creatorUserId,
          payload.assignee_user_id || null,
          payload.title,
          payload.description || null,
          payload.status,
        ]
      );

      if (!result) {
        return c.json(errorResponse("Failed to create task"), 500);
      }

      return c.json(successResponse(result), 201);
    } catch (error) {
      console.error("Failed to create task:", error);

      if (error instanceof DatabaseError) {
        // 外键约束错误
        if (error.code === "23503") {
          return c.json(errorResponse("Project or user not found"), 404);
        }
      }

      return c.json(errorResponse("Failed to create task"), 500);
    }
  }
);

// 独立任务路由 (挂载在 /api/tasks)
export const taskRoutes = new Hono<AuthBindings>();

// 应用认证中间件
taskRoutes.use("*", authMiddleware);

// GET /api/tasks/:id - 获取任务详情
taskRoutes.get("/:id", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const id = c.req.param("id");

  // 验证 UUID 格式
  if (!isValidUUID(id)) {
    return c.json(errorResponse("Invalid task ID format"), 400);
  }

  try {
    const result = await db.queryOne<Task>(
      "SELECT * FROM shared_tasks WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (!result) {
      return c.json(errorResponse("Task not found"), 404);
    }

    return c.json(successResponse(result));
  } catch (error) {
    console.error("Failed to get task:", error);
    return c.json(errorResponse("Failed to get task"), 500);
  }
});

// PUT /api/tasks/:id - 更新任务
taskRoutes.put(
  "/:id",
  requireAuth,
  zValidator("json", updateTaskSchema),
  async (c) => {
    const db = createDatabaseService(c);
    const id = c.req.param("id");
    const payload = c.req.valid("json");

    // 验证 UUID 格式
    if (!isValidUUID(id)) {
      return c.json(errorResponse("Invalid task ID format"), 400);
    }

    // 检查是否有更新内容
    if (
      !payload.title &&
      payload.description === undefined &&
      !payload.status &&
      payload.assignee_user_id === undefined
    ) {
      return c.json(errorResponse("No fields to update"), 400);
    }

    try {
      // 先获取现有任务
      const existingTask = await db.queryOne<Task>(
        "SELECT * FROM shared_tasks WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (!existingTask) {
        return c.json(errorResponse("Task not found"), 404);
      }

      // 构建动态更新语句
      const updates: string[] = ["version = version + 1"];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (payload.title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        params.push(payload.title);
        paramIndex++;
      }

      if (payload.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(payload.description);
        paramIndex++;
      }

      if (payload.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(payload.status);
        paramIndex++;
      }

      if (payload.assignee_user_id !== undefined) {
        updates.push(`assignee_user_id = $${paramIndex}`);
        params.push(payload.assignee_user_id);
        paramIndex++;
      }

      params.push(id);

      const result = await db.queryOne<Task>(
        `UPDATE shared_tasks
         SET ${updates.join(", ")}
         WHERE id = $${paramIndex} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (!result) {
        return c.json(errorResponse("Task not found"), 404);
      }

      return c.json(successResponse(result));
    } catch (error) {
      console.error("Failed to update task:", error);

      if (error instanceof DatabaseError) {
        // 外键约束错误 - assignee_user_id 不存在
        if (error.code === "23503") {
          return c.json(errorResponse("Assignee user not found"), 404);
        }
      }

      return c.json(errorResponse("Failed to update task"), 500);
    }
  }
);

// PATCH /api/tasks/:id/status - 更新任务状态
taskRoutes.patch(
  "/:id/status",
  requireAuth,
  zValidator("json", updateStatusSchema),
  async (c) => {
    const db = createDatabaseService(c);
    const id = c.req.param("id");
    const { status } = c.req.valid("json");

    // 验证 UUID 格式
    if (!isValidUUID(id)) {
      return c.json(errorResponse("Invalid task ID format"), 400);
    }

    try {
      const result = await db.queryOne<Task>(
        `UPDATE shared_tasks
         SET status = $1, version = version + 1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [status, id]
      );

      if (!result) {
        return c.json(errorResponse("Task not found"), 404);
      }

      return c.json(successResponse(result));
    } catch (error) {
      console.error("Failed to update task status:", error);
      return c.json(errorResponse("Failed to update task status"), 500);
    }
  }
);

// DELETE /api/tasks/:id - 软删除任务
taskRoutes.delete("/:id", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const id = c.req.param("id");

  // 验证 UUID 格式
  if (!isValidUUID(id)) {
    return c.json(errorResponse("Invalid task ID format"), 400);
  }

  try {
    // 获取当前用户 ID
    const deletedByUserId = c.get("userId");

    // 软删除：设置 deleted_at 和 deleted_by_user_id
    const result = await db.queryOne<{ id: string }>(
      `UPDATE shared_tasks
       SET deleted_at = NOW(),
           deleted_by_user_id = $2,
           version = version + 1
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, deletedByUserId]
    );

    if (!result) {
      return c.json(errorResponse("Task not found"), 404);
    }

    return c.json(successResponse({ deleted: true, id }));
  } catch (error) {
    console.error("Failed to delete task:", error);
    return c.json(errorResponse("Failed to delete task"), 500);
  }
});

// UUID 验证辅助函数
function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default taskRoutes;
