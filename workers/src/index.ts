/**
 * @file index.ts
 * @description Cloudflare Workers API 主入口 - Hono 应用初始化
 *
 * @input HTTP 请求
 * @output HTTP 响应
 * @position workers/src (API 入口)
 */

import { Hono } from "hono";
import {
  apiRateLimit,
  apiSecurityHeaders,
  authMiddleware,
  corsMiddleware,
  getSessionClaims,
  getUserId,
} from "./middleware";
import billingRoutes, {
  webhookRoutes as billingWebhookRoutes,
} from "./routes/billing";
import githubRoutes from "./routes/github";
import organizationRoutes from "./routes/organizations";
import projectRoutes from "./routes/projects";
import r2Routes from "./routes/r2";
import sessionRoutes, { taskSessionRoutes } from "./routes/sessions";
import settingsRoutes from "./routes/settings";
import storageRoutes from "./routes/storage";
import taskRoutes, { projectTaskRoutes } from "./routes/tasks";
import { createDatabaseService } from "./services";

// Durable Objects
export { CollaborationSession, TaskSession } from "./durable-objects";

// Cloudflare Workers 环境绑定类型
export type Bindings = {
  // Cloudflare services
  DB: Hyperdrive;
  R2_BUCKET: R2Bucket;
  TASK_SESSION: DurableObjectNamespace;
  COLLABORATION_SESSION: DurableObjectNamespace;
  // Clerk authentication
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_JWT_KEY?: string; // PEM public key for networkless JWT verification
  // Stripe billing
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  // GitHub App (optional - for GitHub integration)
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string; // Base64 encoded PEM
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_APP_SLUG: string;
};

// 创建 Hono 应用实例
const app = new Hono<{ Bindings: Bindings }>();

// CORS 中间件 - 允许前端跨域访问
app.use("*", corsMiddleware);

// 安全头中间件 - 添加 X-Frame-Options, X-Content-Type-Options 等
app.use("/api/*", apiSecurityHeaders);

// 速率限制中间件 - 100 req/min
app.use("/api/*", apiRateLimit);

// 健康检查端点
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "clauding-api",
  });
});

// ============================================================================
// Compatibility Endpoints for Web Mode
// These endpoints provide default responses for APIs that only exist in the
// local Rust backend. This allows the frontend to work without errors.
// ============================================================================

// Web version system info endpoint
// Returns default configuration for browser-based usage
// Note: This endpoint already uses { success: true, data: ... } format
app.get("/api/info", (c) => {
  return c.json({
    success: true,
    data: {
      config: {
        disclaimer_acknowledged: true,
        onboarding_acknowledged: true,
        analytics_enabled: false,
        language: "en",
      },
      environment: {
        os_type: "web",
        os_version: "browser",
        os_architecture: "wasm",
        bitness: "64",
      },
      executors: {},
      capabilities: {},
      analytics_user_id: "",
      login_status: { logged_in: false },
    },
  });
});

// Empty profiles endpoint for Web version
// Local executors (Claude Code, Cursor, etc.) don't apply in Web mode
// Note: This endpoint already uses { success: true, data: ... } format
app.get("/api/profiles", (c) => {
  return c.json({
    success: true,
    data: {
      content: "{}",
      path: "",
    },
  });
});

// Tags API compatibility for Web version
// Tags are stored locally in desktop app's SQLite database
// In web mode, return empty array (no local tags)
app.get("/api/tags", (c) => {
  return c.json({ success: true, data: [] });
});

app.post("/api/tags", (c) => {
  return c.json(
    {
      error: "Not available",
      message: "Tags are only available in desktop app",
    },
    501
  );
});

app.put("/api/tags/:tagId", (c) => {
  return c.json(
    {
      error: "Not available",
      message: "Tags are only available in desktop app",
    },
    501
  );
});

app.delete("/api/tags/:tagId", (c) => {
  return c.json(
    {
      error: "Not available",
      message: "Tags are only available in desktop app",
    },
    501
  );
});

// Repos API compatibility for Web version
// Creating local git repositories requires filesystem access (desktop app only)
app.post("/api/repos/init", (c) => {
  return c.json(
    {
      error: "Not available",
      message:
        "Creating local repositories is only available in desktop app. In web mode, please use an existing git repository.",
    },
    501
  );
});

// Filesystem API compatibility for Web version
// Git repository scanning requires filesystem access (desktop app only)
// Returns empty array since Web mode cannot scan local filesystem
app.get("/api/filesystem/git-repos", (c) => {
  return c.json({
    success: true,
    data: [],
  });
});

// Editor availability check for Web version
// Editors (VS Code, Cursor, etc.) are local desktop features
// In web mode, always return unavailable
app.get("/api/editors/check-availability", (c) => {
  return c.json({
    success: true,
    data: {
      available: false,
      message: "Editor availability check is only available in desktop app",
    },
  });
});

// ============================================================================
// OAuth Handoff Endpoints for Legacy Authentication
// These endpoints are called when Clerk is disabled and the app falls back
// to the legacy OAuth flow (used by desktop app)
// ============================================================================

// POST /api/auth/handoff/init - Initialize OAuth handoff
// In web mode without Clerk, we return an error directing users to enable Clerk
app.post("/api/auth/handoff/init", (c) => {
  return c.json(
    {
      error: "OAuth handoff not available",
      message:
        "OAuth handoff is only available in desktop app. Please enable Clerk authentication for web mode, or use the desktop application.",
      code: "OAUTH_NOT_AVAILABLE",
    },
    501
  );
});

// ============================================================================
// Authentication Status Endpoint
// Returns the current user's login status and profile information
// This endpoint is called by frontend's useAuthStatus hook during OAuth polling
// ============================================================================
app.get("/api/auth/status", authMiddleware, async (c) => {
  const userId = getUserId(c);
  const claims = getSessionClaims(c);

  if (!(userId && claims)) {
    // Not authenticated - return logged_in: false
    return c.json({
      success: true,
      data: {
        logged_in: false,
        profile: null,
        degraded: null,
      },
    });
  }

  // User is authenticated - return profile information
  // ProfileResponse expects: user_id (string), username (string|null), email (string), providers (array)
  return c.json({
    success: true,
    data: {
      logged_in: true,
      profile: {
        user_id: userId,
        username: claims.email?.split("@")[0] || null,
        email: claims.email || "",
        providers: [],
      },
      degraded: null,
    },
  });
});

// Config API compatibility for Web version
// The frontend uses /api/config for settings, but Workers uses /api/settings
// This endpoint bridges the gap by fetching from settings API and merging with defaults
app.get("/api/config", async (c) => {
  // Default config structure that frontend expects
  const defaultConfig = {
    config_version: "1.0.0",
    theme: "SYSTEM",
    executor_profile: "default",
    disclaimer_acknowledged: true,
    onboarding_acknowledged: true,
    notifications: {
      sound_enabled: false,
      push_enabled: false,
      sound_file: "ABSTRACT_SOUND1",
    },
    editor: {
      editor_type: "VS_CODE",
      custom_command: null,
      remote_ssh_host: null,
      remote_ssh_user: null,
    },
    github: {
      pat: null,
      oauth_token: null,
      username: null,
      primary_email: null,
      default_pr_base: null,
    },
    analytics_enabled: false,
    workspace_dir: null,
    last_app_version: null,
    show_release_notes: false,
    language: "BROWSER",
    git_branch_prefix: "",
    showcases: { seen_features: [] },
    pr_auto_description_enabled: false,
    pr_auto_description_prompt: null,
  };

  try {
    // Try to fetch user settings from /api/settings
    const settingsUrl = new URL(c.req.url);
    settingsUrl.pathname = "/api/settings";

    const settingsResponse = await app.fetch(
      new Request(settingsUrl.toString(), {
        method: "GET",
        headers: c.req.raw.headers,
      }),
      c.env
    );

    if (settingsResponse.ok) {
      const settingsData = (await settingsResponse.json()) as {
        success: boolean;
        data?: {
          theme?: string;
          language?: string;
          notifications?: { sound_enabled: boolean; push_enabled: boolean };
          analytics_enabled?: boolean;
          pr_auto_description_enabled?: boolean;
          pr_auto_description_prompt?: string | null;
          git_branch_prefix?: string;
        };
      };
      if (settingsData.success && settingsData.data) {
        const settings = settingsData.data;
        // Merge user settings into default config
        return c.json({
          success: true,
          data: {
            ...defaultConfig,
            theme: settings.theme || defaultConfig.theme,
            language: settings.language || defaultConfig.language,
            notifications: {
              ...defaultConfig.notifications,
              sound_enabled:
                settings.notifications?.sound_enabled ??
                defaultConfig.notifications.sound_enabled,
              push_enabled:
                settings.notifications?.push_enabled ??
                defaultConfig.notifications.push_enabled,
            },
            analytics_enabled:
              settings.analytics_enabled ?? defaultConfig.analytics_enabled,
            pr_auto_description_enabled:
              settings.pr_auto_description_enabled ??
              defaultConfig.pr_auto_description_enabled,
            pr_auto_description_prompt:
              settings.pr_auto_description_prompt ??
              defaultConfig.pr_auto_description_prompt,
            git_branch_prefix:
              settings.git_branch_prefix ?? defaultConfig.git_branch_prefix,
          },
        });
      }
    }
  } catch (error) {
    console.error("Error fetching settings for /api/config:", error);
  }

  // Return default config if settings fetch failed or user not authenticated
  return c.json({ success: true, data: defaultConfig });
});

// PUT /api/config - Save config by forwarding to /api/settings
// Maps Config fields to UserSettings fields
app.put("/api/config", async (c) => {
  try {
    const config = await c.req.json();

    // Map Config theme to UserSettings theme format
    // Config uses: 'SYSTEM', 'DARK', 'LIGHT' (uppercase)
    // UserSettings uses: 'SYSTEM', 'DARK', 'LIGHT' (same)
    const settingsPayload: Record<string, unknown> = {};

    if (config.theme !== undefined) {
      settingsPayload.theme = config.theme;
    }
    if (config.language !== undefined) {
      settingsPayload.language = config.language;
    }
    if (config.notifications !== undefined) {
      settingsPayload.notifications = {
        sound_enabled: config.notifications.sound_enabled ?? false,
        push_enabled: config.notifications.push_enabled ?? false,
      };
    }
    if (config.analytics_enabled !== undefined) {
      settingsPayload.analytics_enabled = config.analytics_enabled;
    }
    if (config.pr_auto_description_enabled !== undefined) {
      settingsPayload.pr_auto_description_enabled =
        config.pr_auto_description_enabled;
    }
    if (config.pr_auto_description_prompt !== undefined) {
      settingsPayload.pr_auto_description_prompt =
        config.pr_auto_description_prompt;
    }
    if (config.git_branch_prefix !== undefined) {
      settingsPayload.git_branch_prefix = config.git_branch_prefix;
    }

    // If no relevant settings to update, just return the config as-is
    if (Object.keys(settingsPayload).length === 0) {
      return c.json({ success: true, data: config });
    }

    // Forward to settings API internally
    const settingsUrl = new URL(c.req.url);
    settingsUrl.pathname = "/api/settings";

    const settingsResponse = await app.fetch(
      new Request(settingsUrl.toString(), {
        method: "PUT",
        headers: c.req.raw.headers,
        body: JSON.stringify(settingsPayload),
      }),
      c.env
    );

    if (!settingsResponse.ok) {
      const error = await settingsResponse.json();
      return c.json(error, settingsResponse.status as 400 | 401 | 500);
    }

    // Return the original config format for frontend compatibility
    return c.json({ success: true, data: config });
  } catch (error) {
    console.error("Error in PUT /api/config:", error);
    return c.json({ success: false, message: "Failed to save config" }, 500);
  }
});

// 数据库健康检查端点
app.get("/api/health/db", async (c) => {
  // 调试：检查 Hyperdrive 连接字符串
  const connStr = c.env.DB?.connectionString;
  const hasConnStr = !!connStr;
  const connStrPreview = connStr ? connStr.substring(0, 30) + "..." : "N/A";

  const db = createDatabaseService(c);
  const health = await db.healthCheck();

  const status = health.connected ? 200 : 503;

  return c.json(
    {
      status: health.connected ? "ok" : "error",
      database: "neon-postgresql",
      connected: health.connected,
      latencyMs: health.latencyMs,
      version: health.version,
      error: health.error,
      debug: {
        hasConnectionString: hasConnStr,
        connectionStringPreview: connStrPreview,
      },
      timestamp: new Date().toISOString(),
    },
    status
  );
});

// R2 存储路由
app.route("/api/r2", r2Routes);

// Projects API 路由
app.route("/api/projects", projectRoutes);

// Project Tasks API 路由 (嵌套在 projects 下)
app.route("/api/projects/:projectId/tasks", projectTaskRoutes);

// Tasks API 路由 (独立任务操作)
app.route("/api/tasks", taskRoutes);

// Task Sessions API 路由 (嵌套在 tasks 下)
app.route("/api/tasks/:taskId/sessions", taskSessionRoutes);

// Sessions API 路由 (独立会话操作)
app.route("/api/sessions", sessionRoutes);

// Organizations API 路由
app.route("/api/organizations", organizationRoutes);

// Storage API 路由 (R2 文件存储)
app.route("/api/storage", storageRoutes);

// Settings API 路由 (用户设置)
app.route("/api/settings", settingsRoutes);

// Billing API 路由 (Stripe 订阅支付)
app.route("/api/billing", billingRoutes);

// Billing Webhook 路由 (Stripe Webhook - 无需认证，使用签名验证)
app.route("/api/billing", billingWebhookRoutes);

// GitHub App API 路由 (Webhook 和 GitHub 集成)
app.route("/api/github", githubRoutes);

// 404 处理
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
});

// 全局错误处理
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500
  );
});

// WebSocket 路由 - 连接到 TaskSession Durable Object
app.get("/api/ws/sessions/:sessionId", async (c) => {
  // 验证 WebSocket 升级请求
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  const sessionId = c.req.param("sessionId");
  const userId = c.req.query("userId");

  if (!sessionId) {
    return c.json({ error: "Missing sessionId" }, 400);
  }

  if (!userId) {
    return c.json({ error: "Missing userId query parameter" }, 400);
  }

  // 获取或创建 Durable Object 实例
  const id = c.env.TASK_SESSION.idFromName(sessionId);
  const stub = c.env.TASK_SESSION.get(id);

  // 转发 WebSocket 请求到 Durable Object
  const url = new URL(c.req.url);
  url.searchParams.set("userId", userId);
  url.searchParams.set("sessionId", sessionId);

  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// REST API - 获取会话状态
app.get("/api/ws/sessions/:sessionId/state", async (c) => {
  const sessionId = c.req.param("sessionId");
  const id = c.env.TASK_SESSION.idFromName(sessionId);
  const stub = c.env.TASK_SESSION.get(id);

  const url = new URL(c.req.url);
  url.pathname = "/state";

  return stub.fetch(new Request(url.toString()));
});

// REST API - 更新会话状态
app.post("/api/ws/sessions/:sessionId/state", async (c) => {
  const sessionId = c.req.param("sessionId");
  const id = c.env.TASK_SESSION.idFromName(sessionId);
  const stub = c.env.TASK_SESSION.get(id);

  const url = new URL(c.req.url);
  url.pathname = "/update";

  return stub.fetch(
    new Request(url.toString(), {
      method: "POST",
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    })
  );
});

// REST API - 获取在线用户
app.get("/api/ws/sessions/:sessionId/presence", async (c) => {
  const sessionId = c.req.param("sessionId");
  const id = c.env.TASK_SESSION.idFromName(sessionId);
  const stub = c.env.TASK_SESSION.get(id);

  const url = new URL(c.req.url);
  url.pathname = "/presence";

  return stub.fetch(new Request(url.toString()));
});

// REST API - 广播消息
app.post("/api/ws/sessions/:sessionId/broadcast", async (c) => {
  const sessionId = c.req.param("sessionId");
  const id = c.env.TASK_SESSION.idFromName(sessionId);
  const stub = c.env.TASK_SESSION.get(id);

  const url = new URL(c.req.url);
  url.pathname = "/broadcast";

  return stub.fetch(
    new Request(url.toString(), {
      method: "POST",
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    })
  );
});

// ============================================================================
// CollaborationSession Routes - 多用户协作编辑
// ============================================================================

// WebSocket 路由 - 连接到 CollaborationSession Durable Object
app.get("/api/ws/collaboration/:documentId", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  const documentId = c.req.param("documentId");
  const userId = c.req.query("userId");
  const displayName = c.req.query("displayName");

  if (!documentId) {
    return c.json({ error: "Missing documentId" }, 400);
  }

  if (!userId) {
    return c.json({ error: "Missing userId query parameter" }, 400);
  }

  // 获取或创建 Durable Object 实例
  const id = c.env.COLLABORATION_SESSION.idFromName(documentId);
  const stub = c.env.COLLABORATION_SESSION.get(id);

  // 转发 WebSocket 请求到 Durable Object
  const url = new URL(c.req.url);
  url.searchParams.set("userId", userId);
  if (displayName) {
    url.searchParams.set("displayName", displayName);
  }

  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// REST API - 获取文档状态
app.get("/api/ws/collaboration/:documentId/document", async (c) => {
  const documentId = c.req.param("documentId");
  const id = c.env.COLLABORATION_SESSION.idFromName(documentId);
  const stub = c.env.COLLABORATION_SESSION.get(id);

  const url = new URL(c.req.url);
  url.pathname = "/document";

  return stub.fetch(new Request(url.toString()));
});

// REST API - 获取协作者列表
app.get("/api/ws/collaboration/:documentId/collaborators", async (c) => {
  const documentId = c.req.param("documentId");
  const id = c.env.COLLABORATION_SESSION.idFromName(documentId);
  const stub = c.env.COLLABORATION_SESSION.get(id);

  const url = new URL(c.req.url);
  url.pathname = "/collaborators";

  return stub.fetch(new Request(url.toString()));
});

// REST API - 获取操作历史
app.get("/api/ws/collaboration/:documentId/history", async (c) => {
  const documentId = c.req.param("documentId");
  const id = c.env.COLLABORATION_SESSION.idFromName(documentId);
  const stub = c.env.COLLABORATION_SESSION.get(id);

  const url = new URL(c.req.url);
  url.pathname = "/history";
  // 转发 query 参数 (limit, from)
  const limit = c.req.query("limit");
  const from = c.req.query("from");
  if (limit) url.searchParams.set("limit", limit);
  if (from) url.searchParams.set("from", from);

  return stub.fetch(new Request(url.toString()));
});

export default app;
