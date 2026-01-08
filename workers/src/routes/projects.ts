/**
 * @file projects.ts
 * @description Projects API 路由 - CRUD 端点
 *
 * @input HTTP 请求
 * @output Project 数据响应
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

// Project 类型定义
export interface Project {
  id: string;
  organization_id: string;
  name: string;
  metadata: Record<string, unknown>;
  created_at: string;
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
const createProjectSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const projectRoutes = new Hono<AuthBindings>();

// 应用认证中间件
projectRoutes.use("*", authMiddleware);

// GET /api/projects - 获取项目列表
projectRoutes.get("/", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const organizationId = c.req.query("organization_id");

  try {
    let query = "SELECT * FROM projects";
    const params: unknown[] = [];

    if (organizationId) {
      query += " WHERE organization_id = $1";
      params.push(organizationId);
    }

    query += " ORDER BY created_at DESC";

    const result = await db.query<Project>(query, params);

    return c.json(successResponse(result.rows));
  } catch (error) {
    console.error("Failed to list projects:", error);
    return c.json(errorResponse("Failed to list projects"), 500);
  }
});

// POST /api/projects - 创建项目
projectRoutes.post(
  "/",
  requireAuth,
  zValidator("json", createProjectSchema),
  async (c) => {
    const db = createDatabaseService(c);
    const payload = c.req.valid("json");

    try {
      const result = await db.queryOne<Project>(
        `INSERT INTO projects (organization_id, name, metadata)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [
          payload.organization_id,
          payload.name,
          JSON.stringify(payload.metadata),
        ]
      );

      if (!result) {
        return c.json(errorResponse("Failed to create project"), 500);
      }

      return c.json(successResponse(result), 201);
    } catch (error) {
      console.error("Failed to create project:", error);

      if (error instanceof DatabaseError) {
        // 外键约束错误 - organization 不存在
        if (error.code === "23503") {
          return c.json(errorResponse("Organization not found"), 404);
        }
      }

      return c.json(errorResponse("Failed to create project"), 500);
    }
  }
);

// GET /api/projects/:id - 获取项目详情
projectRoutes.get("/:id", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const id = c.req.param("id");

  // 验证 UUID 格式
  if (!isValidUUID(id)) {
    return c.json(errorResponse("Invalid project ID format"), 400);
  }

  try {
    const result = await db.queryOne<Project>(
      "SELECT * FROM projects WHERE id = $1",
      [id]
    );

    if (!result) {
      return c.json(errorResponse("Project not found"), 404);
    }

    return c.json(successResponse(result));
  } catch (error) {
    console.error("Failed to get project:", error);
    return c.json(errorResponse("Failed to get project"), 500);
  }
});

// PUT /api/projects/:id - 更新项目
projectRoutes.put(
  "/:id",
  requireAuth,
  zValidator("json", updateProjectSchema),
  async (c) => {
    const db = createDatabaseService(c);
    const id = c.req.param("id");
    const payload = c.req.valid("json");

    // 验证 UUID 格式
    if (!isValidUUID(id)) {
      return c.json(errorResponse("Invalid project ID format"), 400);
    }

    // 检查是否有更新内容
    if (!(payload.name || payload.metadata)) {
      return c.json(errorResponse("No fields to update"), 400);
    }

    try {
      // 构建动态更新语句
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (payload.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(payload.name);
        paramIndex++;
      }

      if (payload.metadata !== undefined) {
        updates.push(`metadata = $${paramIndex}`);
        params.push(JSON.stringify(payload.metadata));
        paramIndex++;
      }

      params.push(id);

      const result = await db.queryOne<Project>(
        `UPDATE projects
         SET ${updates.join(", ")}
         WHERE id = $${paramIndex}
         RETURNING *`,
        params
      );

      if (!result) {
        return c.json(errorResponse("Project not found"), 404);
      }

      return c.json(successResponse(result));
    } catch (error) {
      console.error("Failed to update project:", error);
      return c.json(errorResponse("Failed to update project"), 500);
    }
  }
);

// DELETE /api/projects/:id - 删除项目
projectRoutes.delete("/:id", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const id = c.req.param("id");

  // 验证 UUID 格式
  if (!isValidUUID(id)) {
    return c.json(errorResponse("Invalid project ID format"), 400);
  }

  try {
    const result = await db.query(
      "DELETE FROM projects WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return c.json(errorResponse("Project not found"), 404);
    }

    return c.json(successResponse({ deleted: true, id }));
  } catch (error) {
    console.error("Failed to delete project:", error);
    return c.json(errorResponse("Failed to delete project"), 500);
  }
});

// UUID 验证辅助函数
function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default projectRoutes;
