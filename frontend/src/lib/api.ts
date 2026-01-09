// Import all necessary types from shared types

import type {
  AbortConflictsRequest,
  ApiResponse,
  ApprovalResponse,
  ApprovalStatus,
  AvailabilityInfo,
  BaseCodingAgent,
  ChangeTargetBranchRequest,
  ChangeTargetBranchResponse,
  CheckEditorAvailabilityResponse,
  Config,
  CreateAndStartTaskRequest,
  CreateFollowUpAttempt,
  CreateGitHubPrRequest,
  CreateInvitationRequest,
  CreateInvitationResponse,
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  CreatePrError,
  CreateProject,
  CreateProjectRepo,
  CreateRemoteProjectRequest,
  CreateScratch,
  CreateTag,
  CreateTask,
  CreateTaskAttemptBody,
  CurrentUserResponse,
  DirectoryEntry,
  DirectoryListResponse,
  EditorType,
  ExecutionProcess,
  ExecutionProcessRepoState,
  GetMcpServerResponse,
  GhCliSetupError,
  GitBranch,
  GitOperationError,
  ImageResponse,
  Invitation,
  LinkToExistingRequest,
  ListInvitationsResponse,
  ListMembersResponse,
  ListOrganizationsResponse,
  McpServerQuery,
  MergeTaskAttemptRequest,
  OpenEditorRequest,
  OpenEditorResponse,
  OrganizationMemberWithProfile,
  PrCommentsResponse,
  Project,
  ProjectRepo,
  PushError,
  PushTaskAttemptRequest,
  QueueStatus,
  RebaseTaskAttemptRequest,
  RemoteProject,
  RemoteProjectMembersResponse,
  RenameBranchRequest,
  RenameBranchResponse,
  Repo,
  RepoBranchStatus,
  RepoWithTargetBranch,
  RevokeInvitationRequest,
  RunAgentSetupRequest,
  RunAgentSetupResponse,
  RunScriptError,
  Scratch,
  ScratchType,
  SearchResult,
  Session,
  SharedTaskDetails,
  SharedTaskResponse,
  ShareTaskResponse,
  StatusResponse,
  Tag,
  TagSearchParams,
  Task,
  TaskRelationships,
  TaskWithAttemptStatus,
  TokenResponse,
  UpdateMcpServersBody,
  UpdateMemberRoleRequest,
  UpdateMemberRoleResponse,
  UpdateProject,
  UpdateProjectRepo,
  UpdateScratch,
  UpdateTag,
  UpdateTask,
  UserSystemInfo,
  Workspace,
} from "shared/types";
import type { WorkspaceWithSession } from "@/types/attempt";
import { createWorkspaceWithSession } from "@/types/attempt";

// ============================================================================
// API Configuration
// ============================================================================

/**
 * API Base URL - defaults to empty for local development (uses Vite proxy)
 * Set VITE_API_BASE_URL in production to Workers API endpoint
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Detect if we're running in Web mode (Cloudflare Workers backend)
 * vs Local mode (Rust desktop backend)
 *
 * Detection logic:
 * 1. Explicit VITE_API_BASE_URL set → remote mode
 * 2. Running on known production domains (claud.ing) → remote mode
 * 3. Running on localhost/127.0.0.1 → local mode (desktop app)
 * 4. Running on any other domain → assume remote mode (cloud deployment)
 */
function detectRemoteApiMode(): boolean {
  // Explicit environment variable takes precedence
  if (import.meta.env.VITE_API_BASE_URL) {
    return true;
  }

  // Check if running in browser
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname;

  // Known production domains - Web mode
  const productionDomains = ["claud.ing", "www.claud.ing"];
  if (productionDomains.includes(hostname)) {
    return true;
  }

  // Cloudflare Pages preview domains - Web mode
  if (hostname.endsWith(".pages.dev")) {
    return true;
  }

  // Localhost/127.0.0.1 - Local desktop mode
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return false;
  }

  // Any other domain - assume Web mode (cloud deployment)
  return true;
}

/**
 * Whether the remote API is enabled (Workers API)
 */
export const isRemoteApiEnabled = detectRemoteApiMode();

// ============================================================================
// Authentication - Auth Settled 模式
// ============================================================================

/**
 * Token getter function type - set by ClerkProvider integration
 */
type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

// Auth ready state - resolves when Clerk is loaded and tokenGetter is set
let authReadyResolve: (() => void) | null = null;
let authReadyPromise: Promise<void> | null = null;

// Auth settled state - resolves when auth state is determined (signed in, signed out, or Clerk disabled)
// This ensures API requests wait until we know the final auth state
let authSettled = false;
let authSettledResolve: (() => void) | null = null;
let authSettledPromise: Promise<void> | null = null;

/**
 * Initialize auth settled promise (call once at app startup)
 * This ensures API requests wait for auth state to be determined
 */
export function initAuthSettled() {
  if (!authSettledPromise && !authSettled) {
    authSettledPromise = new Promise((resolve) => {
      authSettledResolve = resolve;
    });
  }
}

/**
 * Signal that auth is pending (Clerk is loading)
 * API requests will wait for auth to be ready before sending
 */
export function setAuthPending() {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      authReadyResolve = resolve;
    });
  }
}

/**
 * Configure the authentication token getter
 * Called from ClerkProvider integration to enable authenticated requests
 */
export function setAuthTokenGetter(getter: TokenGetter) {
  tokenGetter = getter;
  // Resolve the auth ready promise when token getter is set
  if (authReadyResolve) {
    authReadyResolve();
    authReadyResolve = null;
    authReadyPromise = null;
  }
  // Also mark auth as settled (user is signed in)
  markAuthSettled();
}

/**
 * Clear the authentication token getter (on logout or not signed in)
 */
export function clearAuthTokenGetter() {
  tokenGetter = null;
  // Reset auth ready state
  authReadyResolve = null;
  authReadyPromise = null;
  // Note: Don't clear authSettled - "not signed in" is still a determined state
}

/**
 * Mark auth state as settled (determined)
 * Call this when auth state is known: signed in, signed out, or Clerk disabled
 */
export function markAuthSettled() {
  if (!authSettled) {
    authSettled = true;
    if (authSettledResolve) {
      authSettledResolve();
      authSettledResolve = null;
      authSettledPromise = null;
    }
  }
}

/**
 * Reset auth state (for logout then re-login scenarios)
 */
export function resetAuthState() {
  authSettled = false;
  tokenGetter = null;
  authReadyResolve = null;
  authReadyPromise = null;
  authSettledResolve = null;
  authSettledPromise = null;
}

// Timeout for getting auth token
const AUTH_TOKEN_TIMEOUT_MS = 5000; // 5 seconds for token fetch
const AUTH_SETTLED_TIMEOUT_MS = 10000; // 10 seconds max wait for auth to settle

/**
 * Get the current auth token (if available)
 * Waits for auth state to be settled, then fetches token if signed in
 */
async function getAuthToken(): Promise<string | null> {
  // Step 1: Wait for auth state to be determined (settled)
  if (authSettledPromise) {
    try {
      await Promise.race([
        authSettledPromise,
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error("Auth settled timeout")),
            AUTH_SETTLED_TIMEOUT_MS
          )
        ),
      ]);
    } catch {
      console.warn("[API] Auth settled timed out, proceeding without token");
      return null;
    }
  }

  // Step 2: If no tokenGetter, user is not signed in - return null immediately
  if (!tokenGetter) return null;

  // Step 3: Fetch token with timeout
  try {
    const result = await Promise.race([
      tokenGetter(),
      new Promise<null>((resolve) =>
        setTimeout(() => {
          console.warn(
            "[API] Auth token fetch timed out after",
            AUTH_TOKEN_TIMEOUT_MS,
            "ms"
          );
          resolve(null);
        }, AUTH_TOKEN_TIMEOUT_MS)
      ),
    ]);
    return result;
  } catch (error) {
    console.warn("[API] Failed to get auth token:", error);
    return null;
  }
}

// ============================================================================
// Error Handling
// ============================================================================

export class ApiError<E = unknown> extends Error {
  public status?: number;
  public error_data?: E;
  public isAuthError: boolean;
  public isNetworkError: boolean;

  constructor(
    message: string,
    public statusCode?: number,
    public response?: Response,
    error_data?: E
  ) {
    super(message);
    this.name = "ApiError";
    this.status = statusCode;
    this.error_data = error_data;
    this.isAuthError = statusCode === 401 || statusCode === 403;
    this.isNetworkError = statusCode === undefined;
  }
}

/**
 * Auth error event - emitted when authentication fails
 * Components can listen to handle logout/redirect
 */
export type AuthErrorHandler = (error: ApiError) => void;
let authErrorHandler: AuthErrorHandler | null = null;

export function setAuthErrorHandler(handler: AuthErrorHandler) {
  authErrorHandler = handler;
}

// ============================================================================
// Request Helper
// ============================================================================

/**
 * Build full URL with base URL prefix
 */
function buildUrl(path: string): string {
  // If path already has a protocol, return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

// Default timeout for API requests (10 seconds)
const API_TIMEOUT_MS = 10000;

const makeRequest = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers ?? {});

  // Set default content type
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Add authentication header if token is available
  const token = await getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Build full URL
  const fullUrl = buildUrl(url);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
      credentials: isRemoteApiEnabled ? "include" : "same-origin",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle auth errors globally
    if (response.status === 401 || response.status === 403) {
      const error = new ApiError(
        response.status === 401 ? "Unauthorized" : "Forbidden",
        response.status,
        response
      );
      if (authErrorHandler) {
        authErrorHandler(error);
      }
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Check if it was a timeout
    if (error instanceof Error && error.name === "AbortError") {
      const timeoutError = new ApiError(
        `Request timed out after ${API_TIMEOUT_MS}ms`,
        undefined,
        undefined
      );
      console.error("[API Timeout]", {
        url: fullUrl,
        timeout: API_TIMEOUT_MS,
        timestamp: new Date().toISOString(),
      });
      throw timeoutError;
    }

    // Network error
    const networkError = new ApiError(
      error instanceof Error ? error.message : "Network error",
      undefined,
      undefined
    );
    console.error("[API Network Error]", {
      url: fullUrl,
      error: networkError.message,
      timestamp: new Date().toISOString(),
    });
    throw networkError;
  }
};

export type Ok<T> = { success: true; data: T };
export type Err<E> = { success: false; error: E | undefined; message?: string };

// Result type for endpoints that need typed errors
export type Result<T, E> = Ok<T> | Err<E>;

// Special handler for Result-returning endpoints
const handleApiResponseAsResult = async <T, E>(
  response: Response
): Promise<Result<T, E>> => {
  if (!response.ok) {
    // HTTP error - no structured error data
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    return {
      success: false,
      error: undefined,
      message: errorMessage,
    };
  }

  const result: ApiResponse<T, E> = await response.json();

  if (!result.success) {
    return {
      success: false,
      error: result.error_data || undefined,
      message: result.message || undefined,
    };
  }

  return { success: true, data: result.data as T };
};

export const handleApiResponse = async <T, E = T>(
  response: Response
): Promise<T> => {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Fallback to status text if JSON parsing fails
      errorMessage = response.statusText || errorMessage;
    }

    console.error("[API Error]", {
      message: errorMessage,
      status: response.status,
      response,
      endpoint: response.url,
      timestamp: new Date().toISOString(),
    });
    throw new ApiError<E>(errorMessage, response.status, response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const result: ApiResponse<T, E> = await response.json();

  if (!result.success) {
    // Check for error_data first (structured errors), then fall back to message
    if (result.error_data) {
      console.error("[API Error with data]", {
        error_data: result.error_data,
        message: result.message,
        status: response.status,
        response,
        endpoint: response.url,
        timestamp: new Date().toISOString(),
      });
      // Throw a properly typed error with the error data
      throw new ApiError<E>(
        result.message || "API request failed",
        response.status,
        response,
        result.error_data
      );
    }

    console.error("[API Error]", {
      message: result.message || "API request failed",
      status: response.status,
      response,
      endpoint: response.url,
      timestamp: new Date().toISOString(),
    });
    throw new ApiError<E>(
      result.message || "API request failed",
      response.status,
      response
    );
  }

  return result.data as T;
};

// Project Management APIs
export const projectsApi = {
  getList: async (): Promise<Project[]> => {
    const response = await makeRequest("/api/projects");
    return handleApiResponse<Project[]>(response);
  },

  create: async (data: CreateProject): Promise<Project> => {
    const response = await makeRequest("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Project>(response);
  },

  update: async (id: string, data: UpdateProject): Promise<Project> => {
    const response = await makeRequest(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Project>(response);
  },

  getRemoteMembers: async (
    projectId: string
  ): Promise<RemoteProjectMembersResponse> => {
    const response = await makeRequest(
      `/api/projects/${projectId}/remote/members`
    );
    return handleApiResponse<RemoteProjectMembersResponse>(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await makeRequest(`/api/projects/${id}`, {
      method: "DELETE",
    });
    return handleApiResponse<void>(response);
  },

  openEditor: async (
    id: string,
    data: OpenEditorRequest
  ): Promise<OpenEditorResponse> => {
    const response = await makeRequest(`/api/projects/${id}/open-editor`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<OpenEditorResponse>(response);
  },

  searchFiles: async (
    id: string,
    query: string,
    mode?: string,
    options?: RequestInit
  ): Promise<SearchResult[]> => {
    const modeParam = mode ? `&mode=${encodeURIComponent(mode)}` : "";
    const response = await makeRequest(
      `/api/projects/${id}/search?q=${encodeURIComponent(query)}${modeParam}`,
      options
    );
    return handleApiResponse<SearchResult[]>(response);
  },

  linkToExisting: async (
    localProjectId: string,
    data: LinkToExistingRequest
  ): Promise<Project> => {
    const response = await makeRequest(`/api/projects/${localProjectId}/link`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Project>(response);
  },

  createAndLink: async (
    localProjectId: string,
    data: CreateRemoteProjectRequest
  ): Promise<Project> => {
    const response = await makeRequest(
      `/api/projects/${localProjectId}/link/create`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse<Project>(response);
  },

  unlink: async (projectId: string): Promise<Project> => {
    const response = await makeRequest(`/api/projects/${projectId}/link`, {
      method: "DELETE",
    });
    return handleApiResponse<Project>(response);
  },

  getRepositories: async (projectId: string): Promise<Repo[]> => {
    const response = await makeRequest(
      `/api/projects/${projectId}/repositories`
    );
    return handleApiResponse<Repo[]>(response);
  },

  addRepository: async (
    projectId: string,
    data: CreateProjectRepo
  ): Promise<Repo> => {
    const response = await makeRequest(
      `/api/projects/${projectId}/repositories`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse<Repo>(response);
  },

  deleteRepository: async (
    projectId: string,
    repoId: string
  ): Promise<void> => {
    const response = await makeRequest(
      `/api/projects/${projectId}/repositories/${repoId}`,
      {
        method: "DELETE",
      }
    );
    return handleApiResponse<void>(response);
  },

  getRepository: async (
    projectId: string,
    repoId: string
  ): Promise<ProjectRepo> => {
    const response = await makeRequest(
      `/api/projects/${projectId}/repositories/${repoId}`
    );
    return handleApiResponse<ProjectRepo>(response);
  },

  updateRepository: async (
    projectId: string,
    repoId: string,
    data: UpdateProjectRepo
  ): Promise<ProjectRepo> => {
    const response = await makeRequest(
      `/api/projects/${projectId}/repositories/${repoId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse<ProjectRepo>(response);
  },
};

// Task Management APIs
export const tasksApi = {
  getById: async (taskId: string): Promise<Task> => {
    const response = await makeRequest(`/api/tasks/${taskId}`);
    return handleApiResponse<Task>(response);
  },

  create: async (data: CreateTask): Promise<Task> => {
    const response = await makeRequest("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Task>(response);
  },

  createAndStart: async (
    data: CreateAndStartTaskRequest
  ): Promise<TaskWithAttemptStatus> => {
    const response = await makeRequest("/api/tasks/create-and-start", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<TaskWithAttemptStatus>(response);
  },

  update: async (taskId: string, data: UpdateTask): Promise<Task> => {
    const response = await makeRequest(`/api/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Task>(response);
  },

  delete: async (taskId: string): Promise<void> => {
    const response = await makeRequest(`/api/tasks/${taskId}`, {
      method: "DELETE",
    });
    return handleApiResponse<void>(response);
  },

  share: async (taskId: string): Promise<ShareTaskResponse> => {
    const response = await makeRequest(`/api/tasks/${taskId}/share`, {
      method: "POST",
    });
    return handleApiResponse<ShareTaskResponse>(response);
  },

  reassign: async (
    sharedTaskId: string,
    data: { new_assignee_user_id: string | null }
  ): Promise<SharedTaskResponse> => {
    const payload = {
      new_assignee_user_id: data.new_assignee_user_id,
    };

    const response = await makeRequest(
      `/api/shared-tasks/${sharedTaskId}/assign`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    return handleApiResponse<SharedTaskResponse>(response);
  },

  unshare: async (sharedTaskId: string): Promise<void> => {
    const response = await makeRequest(`/api/shared-tasks/${sharedTaskId}`, {
      method: "DELETE",
    });
    return handleApiResponse<void>(response);
  },

  linkToLocal: async (data: SharedTaskDetails): Promise<Task | null> => {
    const response = await makeRequest("/api/shared-tasks/link-to-local", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Task | null>(response);
  },
};

// Sessions API
export const sessionsApi = {
  getByWorkspace: async (workspaceId: string): Promise<Session[]> => {
    const response = await makeRequest(
      `/api/sessions?workspace_id=${workspaceId}`
    );
    return handleApiResponse<Session[]>(response);
  },

  getById: async (sessionId: string): Promise<Session> => {
    const response = await makeRequest(`/api/sessions/${sessionId}`);
    return handleApiResponse<Session>(response);
  },

  create: async (data: {
    workspace_id: string;
    executor?: string;
  }): Promise<Session> => {
    const response = await makeRequest("/api/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Session>(response);
  },

  followUp: async (
    sessionId: string,
    data: CreateFollowUpAttempt
  ): Promise<ExecutionProcess> => {
    const response = await makeRequest(`/api/sessions/${sessionId}/follow-up`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<ExecutionProcess>(response);
  },
};

// Task Attempts APIs
export const attemptsApi = {
  getChildren: async (attemptId: string): Promise<TaskRelationships> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/children`
    );
    return handleApiResponse<TaskRelationships>(response);
  },

  getAll: async (taskId: string): Promise<Workspace[]> => {
    const response = await makeRequest(`/api/task-attempts?task_id=${taskId}`);
    return handleApiResponse<Workspace[]>(response);
  },

  get: async (attemptId: string): Promise<Workspace> => {
    const response = await makeRequest(`/api/task-attempts/${attemptId}`);
    return handleApiResponse<Workspace>(response);
  },

  /** Get workspace with latest session */
  getWithSession: async (attemptId: string): Promise<WorkspaceWithSession> => {
    const [workspace, sessions] = await Promise.all([
      attemptsApi.get(attemptId),
      sessionsApi.getByWorkspace(attemptId),
    ]);
    return createWorkspaceWithSession(workspace, sessions[0]);
  },

  create: async (data: CreateTaskAttemptBody): Promise<Workspace> => {
    const response = await makeRequest("/api/task-attempts", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Workspace>(response);
  },

  stop: async (attemptId: string): Promise<void> => {
    const response = await makeRequest(`/api/task-attempts/${attemptId}/stop`, {
      method: "POST",
    });
    return handleApiResponse<void>(response);
  },

  runAgentSetup: async (
    attemptId: string,
    data: RunAgentSetupRequest
  ): Promise<RunAgentSetupResponse> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/run-agent-setup`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse<RunAgentSetupResponse>(response);
  },

  openEditor: async (
    attemptId: string,
    data: OpenEditorRequest
  ): Promise<OpenEditorResponse> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/open-editor`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse<OpenEditorResponse>(response);
  },

  getBranchStatus: async (attemptId: string): Promise<RepoBranchStatus[]> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/branch-status`
    );
    return handleApiResponse<RepoBranchStatus[]>(response);
  },

  getRepos: async (attemptId: string): Promise<RepoWithTargetBranch[]> => {
    const response = await makeRequest(`/api/task-attempts/${attemptId}/repos`);
    return handleApiResponse<RepoWithTargetBranch[]>(response);
  },

  merge: async (
    attemptId: string,
    data: MergeTaskAttemptRequest
  ): Promise<void> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/merge`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse<void>(response);
  },

  push: async (
    attemptId: string,
    data: PushTaskAttemptRequest
  ): Promise<Result<void, PushError>> => {
    const response = await makeRequest(`/api/task-attempts/${attemptId}/push`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponseAsResult<void, PushError>(response);
  },

  forcePush: async (
    attemptId: string,
    data: PushTaskAttemptRequest
  ): Promise<Result<void, PushError>> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/push/force`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return handleApiResponseAsResult<void, PushError>(response);
  },

  rebase: async (
    attemptId: string,
    data: RebaseTaskAttemptRequest
  ): Promise<Result<void, GitOperationError>> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/rebase`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return handleApiResponseAsResult<void, GitOperationError>(response);
  },

  change_target_branch: async (
    attemptId: string,
    data: ChangeTargetBranchRequest
  ): Promise<ChangeTargetBranchResponse> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/change-target-branch`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse<ChangeTargetBranchResponse>(response);
  },

  renameBranch: async (
    attemptId: string,
    newBranchName: string
  ): Promise<RenameBranchResponse> => {
    const payload: RenameBranchRequest = {
      new_branch_name: newBranchName,
    };
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/rename-branch`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return handleApiResponse<RenameBranchResponse>(response);
  },

  abortConflicts: async (
    attemptId: string,
    data: AbortConflictsRequest
  ): Promise<void> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/conflicts/abort`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse<void>(response);
  },

  createPR: async (
    attemptId: string,
    data: CreateGitHubPrRequest
  ): Promise<Result<string, CreatePrError>> => {
    const response = await makeRequest(`/api/task-attempts/${attemptId}/pr`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponseAsResult<string, CreatePrError>(response);
  },

  startDevServer: async (attemptId: string): Promise<void> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/start-dev-server`,
      {
        method: "POST",
      }
    );
    return handleApiResponse<void>(response);
  },

  setupGhCli: async (attemptId: string): Promise<ExecutionProcess> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/gh-cli-setup`,
      {
        method: "POST",
      }
    );
    return handleApiResponse<ExecutionProcess, GhCliSetupError>(response);
  },

  runSetupScript: async (
    attemptId: string
  ): Promise<Result<ExecutionProcess, RunScriptError>> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/run-setup-script`,
      {
        method: "POST",
      }
    );
    return handleApiResponseAsResult<ExecutionProcess, RunScriptError>(
      response
    );
  },

  runCleanupScript: async (
    attemptId: string
  ): Promise<Result<ExecutionProcess, RunScriptError>> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/run-cleanup-script`,
      {
        method: "POST",
      }
    );
    return handleApiResponseAsResult<ExecutionProcess, RunScriptError>(
      response
    );
  },

  getPrComments: async (
    attemptId: string,
    repoId: string
  ): Promise<PrCommentsResponse> => {
    const response = await makeRequest(
      `/api/task-attempts/${attemptId}/pr/comments?repo_id=${encodeURIComponent(repoId)}`
    );
    return handleApiResponse<PrCommentsResponse>(response);
  },
};

// Execution Process APIs
export const executionProcessesApi = {
  getDetails: async (processId: string): Promise<ExecutionProcess> => {
    const response = await makeRequest(`/api/execution-processes/${processId}`);
    return handleApiResponse<ExecutionProcess>(response);
  },

  getRepoStates: async (
    processId: string
  ): Promise<ExecutionProcessRepoState[]> => {
    const response = await makeRequest(
      `/api/execution-processes/${processId}/repo-states`
    );
    return handleApiResponse<ExecutionProcessRepoState[]>(response);
  },

  stopExecutionProcess: async (processId: string): Promise<void> => {
    const response = await makeRequest(
      `/api/execution-processes/${processId}/stop`,
      {
        method: "POST",
      }
    );
    return handleApiResponse<void>(response);
  },
};

// File System APIs
export const fileSystemApi = {
  list: async (path?: string): Promise<DirectoryListResponse> => {
    const queryParam = path ? `?path=${encodeURIComponent(path)}` : "";
    const response = await makeRequest(
      `/api/filesystem/directory${queryParam}`
    );
    return handleApiResponse<DirectoryListResponse>(response);
  },

  listGitRepos: async (path?: string): Promise<DirectoryEntry[]> => {
    const queryParam = path ? `?path=${encodeURIComponent(path)}` : "";
    const response = await makeRequest(
      `/api/filesystem/git-repos${queryParam}`
    );
    return handleApiResponse<DirectoryEntry[]>(response);
  },
};

// Repo APIs
export const repoApi = {
  register: async (data: {
    path: string;
    display_name?: string;
  }): Promise<Repo> => {
    const response = await makeRequest("/api/repos", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Repo>(response);
  },

  getBranches: async (repoId: string): Promise<GitBranch[]> => {
    const response = await makeRequest(`/api/repos/${repoId}/branches`);
    return handleApiResponse<GitBranch[]>(response);
  },

  init: async (data: {
    parent_path: string;
    folder_name: string;
  }): Promise<Repo> => {
    const response = await makeRequest("/api/repos/init", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Repo>(response);
  },
};

// Config APIs (backwards compatible)
export const configApi = {
  getConfig: async (): Promise<UserSystemInfo> => {
    const response = await makeRequest("/api/info", { cache: "no-store" });
    return handleApiResponse<UserSystemInfo>(response);
  },
  // Get config for Web mode (from /api/config endpoint in Workers)
  // Note: Workers API returns { success: true, data: Config } format
  getWebConfig: async (): Promise<Config> => {
    const response = await makeRequest("/api/config", { cache: "no-store" });
    const result = await handleApiResponse<{ success: boolean; data: Config }>(
      response
    );
    // Handle wrapped response format from Workers API
    if (result && typeof result === "object" && "data" in result) {
      return result.data;
    }
    // Fallback for direct Config response (backwards compatibility)
    return result as unknown as Config;
  },
  saveConfig: async (config: Config): Promise<Config> => {
    const response = await makeRequest("/api/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
    const result = await handleApiResponse<{ success: boolean; data: Config }>(
      response
    );
    // Handle wrapped response format from Workers API
    if (result && typeof result === "object" && "data" in result) {
      return result.data;
    }
    // Fallback for direct Config response (backwards compatibility)
    return result as unknown as Config;
  },
  checkEditorAvailability: async (
    editorType: EditorType
  ): Promise<CheckEditorAvailabilityResponse> => {
    const response = await makeRequest(
      `/api/editors/check-availability?editor_type=${encodeURIComponent(editorType)}`
    );
    return handleApiResponse<CheckEditorAvailabilityResponse>(response);
  },
  checkAgentAvailability: async (
    agent: BaseCodingAgent
  ): Promise<AvailabilityInfo> => {
    const response = await makeRequest(
      `/api/agents/check-availability?executor=${encodeURIComponent(agent)}`
    );
    return handleApiResponse<AvailabilityInfo>(response);
  },
};

// Task Tags APIs (all tags are global)
export const tagsApi = {
  list: async (params?: TagSearchParams): Promise<Tag[]> => {
    const queryParam = params?.search
      ? `?search=${encodeURIComponent(params.search)}`
      : "";
    const response = await makeRequest(`/api/tags${queryParam}`);
    return handleApiResponse<Tag[]>(response);
  },

  create: async (data: CreateTag): Promise<Tag> => {
    const response = await makeRequest("/api/tags", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Tag>(response);
  },

  update: async (tagId: string, data: UpdateTag): Promise<Tag> => {
    const response = await makeRequest(`/api/tags/${tagId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Tag>(response);
  },

  delete: async (tagId: string): Promise<void> => {
    const response = await makeRequest(`/api/tags/${tagId}`, {
      method: "DELETE",
    });
    return handleApiResponse<void>(response);
  },
};

// MCP Servers APIs
export const mcpServersApi = {
  load: async (query: McpServerQuery): Promise<GetMcpServerResponse> => {
    const params = new URLSearchParams(query);
    const response = await makeRequest(`/api/mcp-config?${params.toString()}`);
    return handleApiResponse<GetMcpServerResponse>(response);
  },
  save: async (
    query: McpServerQuery,
    data: UpdateMcpServersBody
  ): Promise<void> => {
    const params = new URLSearchParams(query);
    // params.set('profile', profile);
    const response = await makeRequest(`/api/mcp-config?${params.toString()}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("[API Error] Failed to save MCP servers", {
        message: errorData.message,
        status: response.status,
        response,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        errorData.message || "Failed to save MCP servers",
        response.status,
        response
      );
    }
  },
};

// Profiles API
export const profilesApi = {
  load: async (): Promise<{ content: string; path: string }> => {
    const response = await makeRequest("/api/profiles");
    return handleApiResponse<{ content: string; path: string }>(response);
  },
  save: async (content: string): Promise<string> => {
    const response = await makeRequest("/api/profiles", {
      method: "PUT",
      body: content,
      headers: {
        "Content-Type": "application/json",
      },
    });
    return handleApiResponse<string>(response);
  },
};

// Images API
export const imagesApi = {
  upload: async (file: File): Promise<ImageResponse> => {
    const formData = new FormData();
    formData.append("image", file);

    const token = await getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(buildUrl("/api/images/upload"), {
      method: "POST",
      body: formData,
      headers,
      credentials: isRemoteApiEnabled ? "include" : "same-origin",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        `Failed to upload image: ${errorText}`,
        response.status,
        response
      );
    }

    return handleApiResponse<ImageResponse>(response);
  },

  uploadForTask: async (taskId: string, file: File): Promise<ImageResponse> => {
    const formData = new FormData();
    formData.append("image", file);

    const token = await getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      buildUrl(`/api/images/task/${taskId}/upload`),
      {
        method: "POST",
        body: formData,
        headers,
        credentials: isRemoteApiEnabled ? "include" : "same-origin",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        `Failed to upload image: ${errorText}`,
        response.status,
        response
      );
    }

    return handleApiResponse<ImageResponse>(response);
  },

  /**
   * Upload an image for a task attempt and immediately copy it to the container.
   * Returns the image with a file_path that can be used in markdown.
   */
  uploadForAttempt: async (
    attemptId: string,
    file: File
  ): Promise<ImageResponse> => {
    const formData = new FormData();
    formData.append("image", file);

    const token = await getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      buildUrl(`/api/task-attempts/${attemptId}/images/upload`),
      {
        method: "POST",
        body: formData,
        headers,
        credentials: isRemoteApiEnabled ? "include" : "same-origin",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        `Failed to upload image: ${errorText}`,
        response.status,
        response
      );
    }

    return handleApiResponse<ImageResponse>(response);
  },

  delete: async (imageId: string): Promise<void> => {
    const response = await makeRequest(`/api/images/${imageId}`, {
      method: "DELETE",
    });
    return handleApiResponse<void>(response);
  },

  getTaskImages: async (taskId: string): Promise<ImageResponse[]> => {
    const response = await makeRequest(`/api/images/task/${taskId}`);
    return handleApiResponse<ImageResponse[]>(response);
  },

  getImageUrl: (imageId: string): string => {
    return buildUrl(`/api/images/${imageId}/file`);
  },
};

// Approval API
export const approvalsApi = {
  respond: async (
    approvalId: string,
    payload: ApprovalResponse,
    signal?: AbortSignal
  ): Promise<ApprovalStatus> => {
    const res = await makeRequest(`/api/approvals/${approvalId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    return handleApiResponse<ApprovalStatus>(res);
  },
};

// ============================================================================
// PKCE (Proof Key for Code Exchange) utilities for OAuth
// ============================================================================

const PKCE_VERIFIER_KEY = "oauth_pkce_verifier";

/**
 * Generate a random string for PKCE verifier (43-128 characters)
 */
function generateVerifier(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(
      byte % 62
    )
  ).join("");
}

/**
 * Generate SHA-256 hash of the verifier (hex encoded)
 */
async function generateChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Store PKCE verifier for later use in token exchange
 */
function storePkceVerifier(verifier: string): void {
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
}

/**
 * Retrieve and clear stored PKCE verifier
 */
export function getPkceVerifier(): string | null {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (verifier) {
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  }
  return verifier;
}

// OAuth API
export const oauthApi = {
  handoffInit: async (
    provider: string,
    returnTo: string
  ): Promise<{ handoff_id: string; authorize_url: string }> => {
    // Generate PKCE verifier and challenge for secure OAuth flow
    const appVerifier = generateVerifier();
    const appChallenge = await generateChallenge(appVerifier);

    // Store verifier for later token exchange
    storePkceVerifier(appVerifier);

    const response = await makeRequest("/api/auth/handoff/init", {
      method: "POST",
      body: JSON.stringify({
        provider,
        return_to: returnTo,
        app_challenge: appChallenge,
      }),
    });
    return handleApiResponse<{ handoff_id: string; authorize_url: string }>(
      response
    );
  },

  status: async (): Promise<StatusResponse> => {
    const response = await makeRequest("/api/auth/status", {
      cache: "no-store",
    });
    return handleApiResponse<StatusResponse>(response);
  },

  logout: async (): Promise<void> => {
    const response = await makeRequest("/api/auth/logout", {
      method: "POST",
    });
    if (!response.ok) {
      throw new ApiError(
        `Logout failed with status ${response.status}`,
        response.status,
        response
      );
    }
  },

  /** Returns the current access token for the remote server (auto-refreshes if needed) */
  getToken: async (): Promise<TokenResponse | null> => {
    const response = await makeRequest("/api/auth/token");
    if (!response.ok) return null;
    return handleApiResponse<TokenResponse>(response);
  },

  /** Returns the user ID of the currently authenticated user */
  getCurrentUser: async (): Promise<CurrentUserResponse> => {
    const response = await makeRequest("/api/auth/user");
    return handleApiResponse<CurrentUserResponse>(response);
  },
};

// Organizations API
export const organizationsApi = {
  getMembers: async (
    orgId: string
  ): Promise<OrganizationMemberWithProfile[]> => {
    const response = await makeRequest(`/api/organizations/${orgId}/members`);
    const result = await handleApiResponse<ListMembersResponse>(response);
    return result.members;
  },

  getUserOrganizations: async (): Promise<ListOrganizationsResponse> => {
    const response = await makeRequest("/api/organizations");
    return handleApiResponse<ListOrganizationsResponse>(response);
  },

  getProjects: async (orgId: string): Promise<RemoteProject[]> => {
    const response = await makeRequest(`/api/organizations/${orgId}/projects`);
    return handleApiResponse<RemoteProject[]>(response);
  },

  createOrganization: async (
    data: CreateOrganizationRequest
  ): Promise<CreateOrganizationResponse> => {
    const response = await makeRequest("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleApiResponse<CreateOrganizationResponse>(response);
  },

  createInvitation: async (
    orgId: string,
    data: CreateInvitationRequest
  ): Promise<CreateInvitationResponse> => {
    const response = await makeRequest(
      `/api/organizations/${orgId}/invitations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse<CreateInvitationResponse>(response);
  },

  removeMember: async (orgId: string, userId: string): Promise<void> => {
    const response = await makeRequest(
      `/api/organizations/${orgId}/members/${userId}`,
      {
        method: "DELETE",
      }
    );
    return handleApiResponse<void>(response);
  },

  updateMemberRole: async (
    orgId: string,
    userId: string,
    data: UpdateMemberRoleRequest
  ): Promise<UpdateMemberRoleResponse> => {
    const response = await makeRequest(
      `/api/organizations/${orgId}/members/${userId}/role`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse<UpdateMemberRoleResponse>(response);
  },

  listInvitations: async (orgId: string): Promise<Invitation[]> => {
    const response = await makeRequest(
      `/api/organizations/${orgId}/invitations`
    );
    const result = await handleApiResponse<ListInvitationsResponse>(response);
    return result.invitations;
  },

  revokeInvitation: async (
    orgId: string,
    invitationId: string
  ): Promise<void> => {
    const body: RevokeInvitationRequest = { invitation_id: invitationId };
    const response = await makeRequest(
      `/api/organizations/${orgId}/invitations/revoke`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    return handleApiResponse<void>(response);
  },

  deleteOrganization: async (orgId: string): Promise<void> => {
    const response = await makeRequest(`/api/organizations/${orgId}`, {
      method: "DELETE",
    });
    return handleApiResponse<void>(response);
  },
};

// Scratch API
export const scratchApi = {
  create: async (
    scratchType: ScratchType,
    id: string,
    data: CreateScratch
  ): Promise<Scratch> => {
    const response = await makeRequest(`/api/scratch/${scratchType}/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<Scratch>(response);
  },

  get: async (scratchType: ScratchType, id: string): Promise<Scratch> => {
    const response = await makeRequest(`/api/scratch/${scratchType}/${id}`);
    return handleApiResponse<Scratch>(response);
  },

  update: async (
    scratchType: ScratchType,
    id: string,
    data: UpdateScratch
  ): Promise<void> => {
    const response = await makeRequest(`/api/scratch/${scratchType}/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return handleApiResponse<void>(response);
  },

  delete: async (scratchType: ScratchType, id: string): Promise<void> => {
    const response = await makeRequest(`/api/scratch/${scratchType}/${id}`, {
      method: "DELETE",
    });
    return handleApiResponse<void>(response);
  },

  getStreamUrl: (scratchType: ScratchType, id: string): string =>
    buildUrl(`/api/scratch/${scratchType}/${id}/stream/ws`),
};

// Queue API for session follow-up messages
export const queueApi = {
  /**
   * Queue a follow-up message to be executed when current execution finishes
   */
  queue: async (
    sessionId: string,
    data: { message: string; variant: string | null }
  ): Promise<QueueStatus> => {
    const response = await makeRequest(`/api/sessions/${sessionId}/queue`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleApiResponse<QueueStatus>(response);
  },

  /**
   * Cancel a queued follow-up message
   */
  cancel: async (sessionId: string): Promise<QueueStatus> => {
    const response = await makeRequest(`/api/sessions/${sessionId}/queue`, {
      method: "DELETE",
    });
    return handleApiResponse<QueueStatus>(response);
  },

  /**
   * Get the current queue status for a session
   */
  getStatus: async (sessionId: string): Promise<QueueStatus> => {
    const response = await makeRequest(`/api/sessions/${sessionId}/queue`);
    return handleApiResponse<QueueStatus>(response);
  },
};
