/**
 * @file database.ts
 * @description Neon serverless 数据库服务 - 通过 Hyperdrive 连接
 *
 * @input Hyperdrive 绑定
 * @output SQL 查询结果
 * @position workers/src/services (数据库服务层)
 */

import type { Context } from "hono";
import { Pool } from "pg";
import type { Bindings } from "../index";

// 数据库健康状态
export interface DatabaseHealth {
  connected: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
}

// 查询结果类型
export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

// 数据库错误类型
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly query?: string
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * 数据库服务类
 * 通过 Cloudflare Hyperdrive 代理连接 Neon PostgreSQL
 */
export class DatabaseService {
  private pool: Pool;

  constructor(hyperdrive: Hyperdrive) {
    // 使用 Hyperdrive 提供的连接字符串创建连接池
    // Hyperdrive 提供 TCP 连接，Neon driver 通过 WebSocket 代理
    this.pool = new Pool({ connectionString: hyperdrive.connectionString });
  }

  /**
   * 执行 SQL 查询
   * @param query SQL 查询语句
   * @param params 查询参数（防 SQL 注入）
   */
  async query<T = Record<string, unknown>>(
    query: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    try {
      const result = await this.pool.query(query, params);
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount ?? result.rows.length,
      };
    } catch (error) {
      // 详细错误信息用于调试
      let message: string;
      if (error instanceof Error) {
        message = `${error.name}: ${error.message}`;
      } else if (typeof error === "object" && error !== null) {
        message = JSON.stringify(error);
      } else {
        message = String(error);
      }
      const code = (error as { code?: string })?.code;
      throw new DatabaseError(message, code, query);
    }
  }

  /**
   * 执行查询并返回第一行
   * @param query SQL 查询语句
   * @param params 查询参数
   */
  async queryOne<T = Record<string, unknown>>(
    query: string,
    params: unknown[] = []
  ): Promise<T | null> {
    const result = await this.query<T>(query, params);
    return result.rows[0] ?? null;
  }

  /**
   * 执行查询并返回标量值
   * @param query SQL 查询语句
   * @param params 查询参数
   */
  async queryScalar<T = unknown>(
    query: string,
    params: unknown[] = []
  ): Promise<T | null> {
    const row = await this.queryOne<Record<string, T>>(query, params);
    if (!row) return null;
    const keys = Object.keys(row);
    return keys.length > 0 ? row[keys[0]] : null;
  }

  /**
   * 检查数据库健康状态
   */
  async healthCheck(): Promise<DatabaseHealth> {
    const startTime = Date.now();

    try {
      const result = await this.queryOne<{ version: string }>(
        "SELECT version() as version"
      );
      const latencyMs = Date.now() - startTime;

      return {
        connected: true,
        latencyMs,
        version: result?.version,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : "Unknown error";

      return {
        connected: false,
        latencyMs,
        error: message,
      };
    }
  }

  /**
   * 执行事务（简化版）
   * 注意：Neon serverless 不支持传统事务，这里模拟批量执行
   * @param queries 查询列表
   */
  async transaction<T = Record<string, unknown>>(
    queries: Array<{ query: string; params?: unknown[] }>
  ): Promise<QueryResult<T>[]> {
    const results: QueryResult<T>[] = [];

    for (const { query, params = [] } of queries) {
      const result = await this.query<T>(query, params);
      results.push(result);
    }

    return results;
  }
}

/**
 * 从 Hono Context 创建 DatabaseService 实例
 * 支持带有 Bindings 的任意 Context 类型（包括 AuthBindings）
 */
export function createDatabaseService<T extends { Bindings: Bindings }>(
  c: Context<T>
): DatabaseService {
  return new DatabaseService(c.env.DB);
}

/**
 * 工具函数：安全转义标识符（表名、列名）
 * 注意：仅用于动态表名等场景，优先使用参数化查询
 */
export function escapeIdentifier(identifier: string): string {
  // 只允许字母、数字、下划线
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new DatabaseError(`Invalid identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}
