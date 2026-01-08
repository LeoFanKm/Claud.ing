/**
 * @file database.test.ts
 * @description 数据库服务单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError, DatabaseService, escapeIdentifier } from "./database";

// Track mock calls and pool instance
let mockPoolInstance: { query: ReturnType<typeof vi.fn> };
let poolConstructorCalls: Array<{ connectionString: string }> = [];

// Mock @neondatabase/serverless Pool with class-based mock
vi.mock("@neondatabase/serverless", () => {
  return {
    Pool: class MockPool {
      query: ReturnType<typeof vi.fn>;
      constructor(config: { connectionString: string }) {
        poolConstructorCalls.push(config);
        this.query = mockPoolInstance.query;
      }
    },
  };
});

describe("DatabaseService", () => {
  let dbService: DatabaseService;
  let mockHyperdrive: Hyperdrive;

  beforeEach(() => {
    vi.clearAllMocks();
    poolConstructorCalls = [];

    mockPoolInstance = {
      query: vi.fn(),
    };

    mockHyperdrive = {
      connectionString: "postgres://test:test@localhost:5432/testdb",
    } as Hyperdrive;

    dbService = new DatabaseService(mockHyperdrive);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should create Pool with hyperdrive connection string", () => {
      expect(poolConstructorCalls).toHaveLength(1);
      expect(poolConstructorCalls[0]).toEqual({
        connectionString: "postgres://test:test@localhost:5432/testdb",
      });
    });
  });

  describe("query", () => {
    it("should execute query and return results", async () => {
      const mockRows = [
        { id: 1, name: "Test 1" },
        { id: 2, name: "Test 2" },
      ];

      mockPoolInstance.query.mockResolvedValueOnce({
        rows: mockRows,
        rowCount: 2,
      });

      const result = await dbService.query("SELECT * FROM users");

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        "SELECT * FROM users",
        []
      );
      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(2);
    });

    it("should pass parameters to query", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
        rowCount: 1,
      });

      await dbService.query("SELECT * FROM users WHERE id = $1", [123]);

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1",
        [123]
      );
    });

    it("should handle query with multiple parameters", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      await dbService.query(
        "INSERT INTO users (name, email, age) VALUES ($1, $2, $3)",
        ["John", "john@example.com", 30]
      );

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        "INSERT INTO users (name, email, age) VALUES ($1, $2, $3)",
        ["John", "john@example.com", 30]
      );
    });

    it("should throw DatabaseError on query failure", async () => {
      const dbError = new Error("Connection failed");
      (dbError as any).code = "ECONNREFUSED";

      mockPoolInstance.query.mockRejectedValueOnce(dbError);

      await expect(dbService.query("SELECT * FROM users")).rejects.toThrow(
        DatabaseError
      );

      mockPoolInstance.query.mockRejectedValueOnce(dbError);

      try {
        await dbService.query("SELECT * FROM users");
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect((error as DatabaseError).message).toBe("Connection failed");
        expect((error as DatabaseError).code).toBe("ECONNREFUSED");
        expect((error as DatabaseError).query).toBe("SELECT * FROM users");
      }
    });

    it("should handle unknown error types", async () => {
      mockPoolInstance.query.mockRejectedValueOnce("Unknown error string");

      await expect(dbService.query("SELECT 1")).rejects.toThrow(
        "Unknown database error"
      );
    });

    it("should return rowCount from rows.length when rowCount is null", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        rowCount: null,
      });

      const result = await dbService.query("SELECT * FROM items");

      expect(result.rowCount).toBe(3);
    });
  });
  describe("queryOne", () => {
    it("should return first row when exists", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: "First" },
          { id: 2, name: "Second" },
        ],
        rowCount: 2,
      });

      const result = await dbService.queryOne<{ id: number; name: string }>(
        "SELECT * FROM users LIMIT 1"
      );

      expect(result).toEqual({ id: 1, name: "First" });
    });

    it("should return null when no rows", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await dbService.queryOne(
        "SELECT * FROM users WHERE id = $1",
        [999]
      );

      expect(result).toBeNull();
    });

    it("should pass parameters correctly", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ id: 5 }],
        rowCount: 1,
      });

      await dbService.queryOne("SELECT * FROM users WHERE id = $1", [5]);

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1",
        [5]
      );
    });
  });

  describe("queryScalar", () => {
    it("should return first value of first row", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ count: 42 }],
        rowCount: 1,
      });

      const result = await dbService.queryScalar<number>(
        "SELECT COUNT(*) as count FROM users"
      );

      expect(result).toBe(42);
    });

    it("should return null when no rows", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await dbService.queryScalar(
        "SELECT MAX(id) FROM empty_table"
      );

      expect(result).toBeNull();
    });

    it("should return first column when multiple columns", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ a: "first", b: "second" }],
        rowCount: 1,
      });

      const result = await dbService.queryScalar<string>(
        "SELECT a, b FROM test"
      );

      expect(result).toBe("first");
    });

    it("should handle row with no properties", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{}],
        rowCount: 1,
      });

      const result = await dbService.queryScalar("SELECT");

      expect(result).toBeNull();
    });
  });

  describe("healthCheck", () => {
    it("should return connected status on successful query", async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ version: "PostgreSQL 15.4" }],
        rowCount: 1,
      });

      const health = await dbService.healthCheck();

      expect(health.connected).toBe(true);
      expect(health.version).toBe("PostgreSQL 15.4");
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeUndefined();
    });

    it("should return disconnected status on query failure", async () => {
      mockPoolInstance.query.mockRejectedValueOnce(
        new Error("Connection timeout")
      );

      const health = await dbService.healthCheck();

      expect(health.connected).toBe(false);
      expect(health.error).toBe("Connection timeout");
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle unknown error in health check", async () => {
      mockPoolInstance.query.mockRejectedValueOnce("String error");

      const health = await dbService.healthCheck();

      expect(health.connected).toBe(false);
      expect(health.error).toBe("Unknown database error");
    });

    it("should measure latency", async () => {
      mockPoolInstance.query.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ rows: [{ version: "PG" }], rowCount: 1 }),
              10
            )
          )
      );

      const health = await dbService.healthCheck();

      expect(health.latencyMs).toBeGreaterThanOrEqual(10);
    });
  });

  describe("transaction", () => {
    it("should execute multiple queries in order", async () => {
      mockPoolInstance.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await dbService.transaction([
        { query: "INSERT INTO users (name) VALUES ($1)", params: ["User 1"] },
        { query: "INSERT INTO users (name) VALUES ($1)", params: ["User 2"] },
        { query: "DELETE FROM temp" },
      ]);

      expect(results).toHaveLength(3);
      expect(mockPoolInstance.query).toHaveBeenCalledTimes(3);
      expect(mockPoolInstance.query).toHaveBeenNthCalledWith(
        1,
        "INSERT INTO users (name) VALUES ($1)",
        ["User 1"]
      );
      expect(mockPoolInstance.query).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO users (name) VALUES ($1)",
        ["User 2"]
      );
      expect(mockPoolInstance.query).toHaveBeenNthCalledWith(
        3,
        "DELETE FROM temp",
        []
      );
    });

    it("should handle empty transaction", async () => {
      const results = await dbService.transaction([]);

      expect(results).toHaveLength(0);
      expect(mockPoolInstance.query).not.toHaveBeenCalled();
    });

    it("should propagate errors from failed queries", async () => {
      mockPoolInstance.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
        .mockRejectedValueOnce(new Error("Constraint violation"));

      await expect(
        dbService.transaction([
          { query: "INSERT INTO users (name) VALUES ($1)", params: ["User 1"] },
          { query: "INSERT INTO users (id) VALUES ($1)", params: [1] },
        ])
      ).rejects.toThrow(DatabaseError);
    });
  });
});

describe("DatabaseError", () => {
  it("should create error with message only", () => {
    const error = new DatabaseError("Something went wrong");

    expect(error.message).toBe("Something went wrong");
    expect(error.name).toBe("DatabaseError");
    expect(error.code).toBeUndefined();
    expect(error.query).toBeUndefined();
  });

  it("should create error with code and query", () => {
    const error = new DatabaseError(
      "Duplicate key",
      "23505",
      "INSERT INTO users"
    );

    expect(error.message).toBe("Duplicate key");
    expect(error.code).toBe("23505");
    expect(error.query).toBe("INSERT INTO users");
  });

  it("should be instanceof Error", () => {
    const error = new DatabaseError("Test");

    expect(error instanceof Error).toBe(true);
    expect(error instanceof DatabaseError).toBe(true);
  });
});

describe("escapeIdentifier", () => {
  it("should escape valid identifiers", () => {
    expect(escapeIdentifier("users")).toBe('"users"');
    expect(escapeIdentifier("user_settings")).toBe('"user_settings"');
    expect(escapeIdentifier("Table123")).toBe('"Table123"');
    expect(escapeIdentifier("_private")).toBe('"_private"');
  });

  it("should throw on invalid identifiers", () => {
    expect(() => escapeIdentifier("user-name")).toThrow(DatabaseError);
    expect(() => escapeIdentifier("123table")).toThrow(DatabaseError);
    expect(() => escapeIdentifier("user.name")).toThrow(DatabaseError);
    expect(() => escapeIdentifier("user'name")).toThrow(DatabaseError);
    expect(() => escapeIdentifier("user;drop")).toThrow(DatabaseError);
    expect(() => escapeIdentifier("")).toThrow(DatabaseError);
    expect(() => escapeIdentifier("table name")).toThrow(DatabaseError);
  });

  it("should reject SQL injection attempts", () => {
    expect(() => escapeIdentifier("users; DROP TABLE users;")).toThrow();
    expect(() => escapeIdentifier("users'--")).toThrow();
    expect(() => escapeIdentifier('users"')).toThrow();
  });
});
