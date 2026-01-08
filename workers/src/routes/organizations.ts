/**
 * @file organizations.ts
 * @description Organizations API 路由 - 组织管理端点
 *
 * @input HTTP 请求
 * @output Organization 数据响应
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

// Organization 类型定义
export interface Organization {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  created_at: string;
  updated_at: string;
}

// Organization Member 类型定义
export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  last_seen_at: string | null;
  // 关联的用户信息
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
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
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  is_personal: z.boolean().optional().default(false),
});

const organizationRoutes = new Hono<AuthBindings>();

// 应用认证中间件
organizationRoutes.use("*", authMiddleware);

// GET /api/organizations - 获取组织列表
organizationRoutes.get("/", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const userId = c.get("userId");

  try {
    // 获取用户所属的所有组织
    const result = await db.query<Organization>(
      `SELECT o.*
       FROM organizations o
       INNER JOIN organization_member_metadata m ON o.id = m.organization_id
       WHERE m.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );

    return c.json(successResponse(result.rows));
  } catch (error) {
    console.error("Failed to list organizations:", error);
    return c.json(errorResponse("Failed to list organizations"), 500);
  }
});

// POST /api/organizations - 创建组织
organizationRoutes.post(
  "/",
  requireAuth,
  zValidator("json", createOrganizationSchema),
  async (c) => {
    const db = createDatabaseService(c);
    const payload = c.req.valid("json");
    const userId = c.get("userId");

    try {
      // 使用事务创建组织并添加创建者为 admin
      const result = await db.queryOne<Organization>(
        `WITH new_org AS (
           INSERT INTO organizations (name, slug, is_personal)
           VALUES ($1, $2, $3)
           RETURNING *
         ),
         add_member AS (
           INSERT INTO organization_member_metadata (organization_id, user_id, role)
           SELECT id, $4, 'admin'
           FROM new_org
         )
         SELECT * FROM new_org`,
        [payload.name, payload.slug, payload.is_personal, userId]
      );

      if (!result) {
        return c.json(errorResponse("Failed to create organization"), 500);
      }

      return c.json(successResponse(result), 201);
    } catch (error) {
      console.error("Failed to create organization:", error);

      if (error instanceof DatabaseError) {
        // 唯一约束冲突 - slug 已存在
        if (error.code === "23505") {
          return c.json(errorResponse("Organization slug already exists"), 409);
        }
      }

      return c.json(errorResponse("Failed to create organization"), 500);
    }
  }
);

// GET /api/organizations/:id - 获取组织详情
organizationRoutes.get("/:id", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const id = c.req.param("id");
  const userId = c.get("userId");

  if (!isValidUUID(id)) {
    return c.json(errorResponse("Invalid organization ID format"), 400);
  }

  try {
    // 验证用户是否是组织成员
    const result = await db.queryOne<Organization>(
      `SELECT o.*
       FROM organizations o
       INNER JOIN organization_member_metadata m ON o.id = m.organization_id
       WHERE o.id = $1 AND m.user_id = $2`,
      [id, userId]
    );

    if (!result) {
      return c.json(errorResponse("Organization not found"), 404);
    }

    return c.json(successResponse(result));
  } catch (error) {
    console.error("Failed to get organization:", error);
    return c.json(errorResponse("Failed to get organization"), 500);
  }
});

// GET /api/organizations/:id/members - 获取组织成员列表
organizationRoutes.get("/:id/members", requireAuth, async (c) => {
  const db = createDatabaseService(c);
  const id = c.req.param("id");
  const userId = c.get("userId");

  if (!isValidUUID(id)) {
    return c.json(errorResponse("Invalid organization ID format"), 400);
  }

  try {
    // 先验证用户是否是组织成员
    const memberCheck = await db.queryOne(
      `SELECT 1 FROM organization_member_metadata
       WHERE organization_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (!memberCheck) {
      return c.json(
        errorResponse("Organization not found or access denied"),
        404
      );
    }

    // 获取所有成员及其用户信息
    const result = await db.query<OrganizationMember>(
      `SELECT
         m.organization_id,
         m.user_id,
         m.role,
         m.joined_at,
         m.last_seen_at,
         u.email,
         u.first_name,
         u.last_name,
         u.username
       FROM organization_member_metadata m
       INNER JOIN users u ON m.user_id = u.id
       WHERE m.organization_id = $1
       ORDER BY m.joined_at ASC`,
      [id]
    );

    return c.json(successResponse(result.rows));
  } catch (error) {
    console.error("Failed to list organization members:", error);
    return c.json(errorResponse("Failed to list organization members"), 500);
  }
});

// UUID 验证辅助函数
function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default organizationRoutes;
