/**
 * @file github.ts
 * @description GitHub App 服务 - JWT 认证、PR 操作、Webhook 验证
 *
 * @input GitHub App 配置（app_id, private_key, webhook_secret）
 * @output GitHub API 操作结果
 * @position workers/src/services (GitHub 集成服务)
 */

import type { Context } from "hono";
import type { Bindings } from "../index";

// ============================================================================
// Types
// ============================================================================

/** GitHub App 配置 */
export interface GitHubAppConfig {
  appId: string;
  privateKey: string; // Base64 编码的 PEM 私钥
  webhookSecret: string;
  appSlug: string;
}

/** GitHub App Installation 信息 */
export interface InstallationInfo {
  id: number;
  account: {
    login: string;
    type: "Organization" | "User";
    id: number;
  };
  repository_selection: "all" | "selected";
  suspended_at: string | null;
}

/** GitHub 仓库信息 */
export interface Repository {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
}

/** PR 详情 */
export interface PrDetails {
  number: number;
  title: string;
  body: string | null;
  head: PrRef;
  base: PrRef;
  html_url: string;
  state: "open" | "closed" | "merged";
}

/** Git 引用信息 */
export interface PrRef {
  sha: string;
  ref: string;
}

/** Installation Token 响应 */
interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

/** Repositories 响应 */
interface RepositoriesResponse {
  repositories: Repository[];
  total_count: number;
}

/** GitHub API 错误 */
export class GitHubAppError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: string
  ) {
    super(message);
    this.name = "GitHubAppError";
  }
}

// ============================================================================
// Constants
// ============================================================================

const GITHUB_API_BASE = "https://api.github.com";
const USER_AGENT = "ClaudingWorker/1.0";
const API_VERSION = "2022-11-28";

// ============================================================================
// JWT Generation (RS256)
// ============================================================================

/**
 * 将 base64 编码的 PEM 私钥解码并转换为 CryptoKey
 */
async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  // 解码 base64
  const pemContent = atob(privateKeyBase64);

  // 提取 PEM 内容（去掉 header/footer）
  const pemLines = pemContent.split("\n");
  const pemBody = pemLines.filter((line) => !line.startsWith("-----")).join("");

  // 解码 base64 到 ArrayBuffer
  const binaryString = atob(pemBody);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 导入为 CryptoKey
  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}

/**
 * Base64url 编码
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;
  if (typeof data === "string") {
    base64 = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 生成 GitHub App JWT
 * GitHub Apps 使用 RS256 签名的 JWT 进行认证，最大 TTL 10 分钟
 */
async function generateAppJwt(
  appId: string,
  privateKeyBase64: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // 减去 60 秒以处理时钟漂移
  const iat = now - 60;
  // GitHub 允许最多 10 分钟，我们使用 9 分钟
  const exp = now + 9 * 60;

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: appId,
    iat,
    exp,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // 导入私钥
  const privateKey = await importPrivateKey(privateKeyBase64);

  // 签名
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const signatureB64 = base64UrlEncode(signature);

  return `${signingInput}.${signatureB64}`;
}

// ============================================================================
// Webhook Signature Verification
// ============================================================================

/**
 * 验证 GitHub Webhook 签名
 * GitHub 通过 X-Hub-Signature-256 header 发送 HMAC-SHA256 签名
 */
export async function verifyWebhookSignature(
  secret: string,
  signatureHeader: string,
  payload: string | ArrayBuffer
): Promise<boolean> {
  // 提取签名
  if (!signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const expectedSignature = signatureHeader.slice(7);

  // 导入密钥
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // 计算签名
  const payloadBytes =
    typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);

  // 转换为 hex
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 常量时间比较
  if (signatureHex.length !== expectedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signatureHex.length; i++) {
    result |= signatureHex.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

// ============================================================================
// GitHub App Service
// ============================================================================

/**
 * GitHub App 服务类
 * 处理 GitHub App 认证、Installation 管理、PR 操作
 */
export class GitHubAppService {
  private config: GitHubAppConfig;

  constructor(config: GitHubAppConfig) {
    this.config = config;
  }

  /**
   * 获取 App slug（用于构建安装 URL）
   */
  get appSlug(): string {
    return this.config.appSlug;
  }

  /**
   * 获取 webhook secret
   */
  get webhookSecret(): string {
    return this.config.webhookSecret;
  }

  /**
   * 创建通用请求 headers
   */
  private headers(token: string): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": API_VERSION,
    };
  }

  /**
   * 创建 token 认证 headers
   */
  private tokenHeaders(token: string): HeadersInit {
    return {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": API_VERSION,
    };
  }

  /**
   * 生成 App JWT
   */
  private async generateJwt(): Promise<string> {
    return generateAppJwt(this.config.appId, this.config.privateKey);
  }

  /**
   * 获取 Installation Access Token
   * 用于代表 installation 调用 API
   */
  async getInstallationToken(installationId: number): Promise<string> {
    const jwt = await this.generateJwt();

    const response = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: this.headers(jwt),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubAppError(
        `Failed to get installation token: ${response.status}`,
        response.status,
        text
      );
    }

    const data: InstallationTokenResponse = await response.json();
    return data.token;
  }

  /**
   * 获取 Installation 详情
   */
  async getInstallation(installationId: number): Promise<InstallationInfo> {
    const jwt = await this.generateJwt();

    const response = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}`,
      {
        method: "GET",
        headers: this.headers(jwt),
      }
    );

    if (response.status === 404) {
      throw new GitHubAppError("Installation not found", 404);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubAppError(
        `Failed to get installation: ${response.status}`,
        response.status,
        text
      );
    }

    return response.json();
  }

  /**
   * 列出 Installation 可访问的仓库（支持分页）
   */
  async listInstallationRepos(installationId: number): Promise<Repository[]> {
    const token = await this.getInstallationToken(installationId);
    const allRepos: Repository[] = [];
    let page = 1;

    while (true) {
      const response = await fetch(
        `${GITHUB_API_BASE}/installation/repositories?per_page=100&page=${page}`,
        {
          method: "GET",
          headers: this.tokenHeaders(token),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new GitHubAppError(
          `Failed to list repositories: ${response.status}`,
          response.status,
          text
        );
      }

      const data: RepositoriesResponse = await response.json();
      allRepos.push(...data.repositories);

      // 如果不足 100 条，说明是最后一页
      if (data.repositories.length < 100) {
        break;
      }
      page++;
    }

    return allRepos;
  }

  /**
   * 获取 PR 详情
   */
  async getPrDetails(
    installationId: number,
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PrDetails> {
    const token = await this.getInstallationToken(installationId);

    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        method: "GET",
        headers: this.tokenHeaders(token),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubAppError(
        `Failed to get PR details: ${response.status}`,
        response.status,
        text
      );
    }

    return response.json();
  }

  /**
   * 发布 PR 评论
   */
  async postPrComment(
    installationId: number,
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<void> {
    const token = await this.getInstallationToken(installationId);

    // 使用 issues API 发布评论（PR 是特殊的 issue）
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        method: "POST",
        headers: {
          ...this.tokenHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubAppError(
        `Failed to post PR comment: ${response.status}`,
        response.status,
        text
      );
    }
  }

  /**
   * 创建 PR
   */
  async createPr(
    installationId: number,
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<PrDetails> {
    const token = await this.getInstallationToken(installationId);

    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: {
          ...this.tokenHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, body, head, base }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubAppError(
        `Failed to create PR: ${response.status}`,
        response.status,
        text
      );
    }

    return response.json();
  }

  /**
   * 获取仓库的默认分支
   */
  async getDefaultBranch(
    installationId: number,
    owner: string,
    repo: string
  ): Promise<string> {
    const token = await this.getInstallationToken(installationId);

    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      method: "GET",
      headers: this.tokenHeaders(token),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubAppError(
        `Failed to get repository: ${response.status}`,
        response.status,
        text
      );
    }

    const data = (await response.json()) as { default_branch: string };
    return data.default_branch;
  }

  /**
   * 获取文件内容
   */
  async getFileContent(
    installationId: number,
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; sha: string }> {
    const token = await this.getInstallationToken(installationId);

    const url = new URL(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`
    );
    if (ref) {
      url.searchParams.set("ref", ref);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.tokenHeaders(token),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubAppError(
        `Failed to get file content: ${response.status}`,
        response.status,
        text
      );
    }

    const data = (await response.json()) as { content: string; sha: string };
    const content = atob(data.content.replace(/\n/g, ""));
    return { content, sha: data.sha };
  }

  /**
   * 创建或更新文件
   */
  async createOrUpdateFile(
    installationId: number,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string // 如果更新现有文件，需要提供 sha
  ): Promise<void> {
    const token = await this.getInstallationToken(installationId);

    const body: Record<string, string> = {
      message,
      content: btoa(content),
      branch,
    };
    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          ...this.tokenHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubAppError(
        `Failed to create/update file: ${response.status}`,
        response.status,
        text
      );
    }
  }

  /**
   * 创建分支
   */
  async createBranch(
    installationId: number,
    owner: string,
    repo: string,
    branchName: string,
    fromRef: string
  ): Promise<void> {
    const token = await this.getInstallationToken(installationId);

    // 首先获取源 ref 的 SHA
    const refResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${fromRef}`,
      {
        method: "GET",
        headers: this.tokenHeaders(token),
      }
    );

    if (!refResponse.ok) {
      const text = await refResponse.text();
      throw new GitHubAppError(
        `Failed to get ref: ${refResponse.status}`,
        refResponse.status,
        text
      );
    }

    const refData = (await refResponse.json()) as { object: { sha: string } };
    const sha = refData.object.sha;

    // 创建新分支
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`,
      {
        method: "POST",
        headers: {
          ...this.tokenHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubAppError(
        `Failed to create branch: ${response.status}`,
        response.status,
        text
      );
    }
  }
}

// ============================================================================
// Webhook Event Types
// ============================================================================

/** Webhook 事件基础结构 */
export interface WebhookEvent {
  action: string;
  installation?: {
    id: number;
    account: {
      login: string;
      type: string;
    };
  };
  sender: {
    login: string;
    id: number;
  };
}

/** PR Webhook 事件 */
export interface PullRequestEvent extends WebhookEvent {
  action:
    | "opened"
    | "closed"
    | "reopened"
    | "synchronize"
    | "edited"
    | "ready_for_review";
  number: number;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
  };
  repository: {
    id: number;
    full_name: string;
    name: string;
    owner: {
      login: string;
    };
  };
}

/** Installation Webhook 事件 */
export interface InstallationEvent extends WebhookEvent {
  action:
    | "created"
    | "deleted"
    | "suspend"
    | "unsuspend"
    | "new_permissions_accepted";
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
  }>;
}

/** Push Webhook 事件 */
export interface PushEvent extends WebhookEvent {
  ref: string;
  before: string;
  after: string;
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  }>;
  repository: {
    id: number;
    full_name: string;
    name: string;
    owner: {
      login: string;
    };
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 从 Hono Context 创建 GitHubAppService 实例
 */
export function createGitHubAppService<T extends { Bindings: Bindings }>(
  c: Context<T>
): GitHubAppService {
  return new GitHubAppService({
    appId: c.env.GITHUB_APP_ID,
    privateKey: c.env.GITHUB_APP_PRIVATE_KEY,
    webhookSecret: c.env.GITHUB_WEBHOOK_SECRET,
    appSlug: c.env.GITHUB_APP_SLUG,
  });
}

/**
 * 从环境变量创建 GitHubAppService 实例
 */
export function createGitHubAppServiceFromEnv(env: {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_APP_SLUG: string;
}): GitHubAppService {
  return new GitHubAppService({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    appSlug: env.GITHUB_APP_SLUG,
  });
}
