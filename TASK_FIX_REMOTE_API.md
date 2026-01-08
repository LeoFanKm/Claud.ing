# 任务：修复 claud.ing Web 版本的 API 兼容性问题

## 问题背景

claud.ing 项目有两套后端架构：
1. **本地桌面版**：Rust 后端 (`crates/server/`)，提供完整的本地系统 API
2. **Web 版本**：Cloudflare Workers (`workers/`)，提供云端 API

当前前端代码主要为本地版本设计，部署到 Web 版本 (https://claud.ing) 时出现多个 API 404 错误。

## 已修复的问题

### Logo 可见性问题
- **文件**：`frontend/src/components/Logo.tsx:122`
- **问题**：`text-primary` 在浅色模式下是白色，看不见
- **修复**：已改为 `text-foreground font-bold`

## 待修复的问题

### 1. `/api/info` 返回 404

**错误日志**：
```
api/info:1 Failed to load resource: the server responded with a status of 404 ()
```

**分析**：
- **本地版本**：`crates/server/src/routes/config.rs:34` 定义了 `/info` 路由
- **返回内容**：`UserSystemInfo` 包含 `config`, `environment`, `profiles`, `capabilities`, `login_status` 等本地系统信息
- **Workers 版本**：没有这个端点，因为这些是本地桌面特有的信息

**调用位置**：
- `frontend/src/lib/api.ts:968` - `configApi.getConfig()` 调用 `/api/info`
- `frontend/src/components/ConfigProvider.tsx:70` - 在 `useQuery` 中调用

**修复方案**：
```typescript
// 方案 A：前端条件检测
// 在 api.ts 中检测 isRemoteApiEnabled，远程模式下返回默认配置

// 方案 B：Workers 添加兼容端点
// 在 workers/src/index.ts 添加 /api/info 返回 Web 版默认配置
```

### 2. `/api/profiles` 返回 404

**错误日志**：
```
api/profiles:1 Failed to load resource: the server responded with a status of 404 ()
```

**分析**：
- **本地版本**：`crates/server/src/routes/config.rs:38` 定义了 `/profiles` 路由
- **返回内容**：执行器配置（Claude Code, Cursor 等本地 AI 编辑器配置）
- **Workers 版本**：不需要，Web 版不支持本地执行器

**调用位置**：
- `frontend/src/lib/api.ts:1067` - `profilesApi.load()` 调用 `/api/profiles`

**修复方案**：
```typescript
// 方案 A：前端条件检测
// 远程模式下跳过 profiles 加载

// 方案 B：Workers 添加兼容端点返回空配置
```

### 3. WebSocket `/api/projects/stream/ws` 连接失败

**错误日志**：
```
WebSocket connection to 'wss://claud.ing/api/projects/stream/ws' failed
```

**分析**：
- **本地版本**：使用 JSON Patch WebSocket 实时同步项目列表
- **Workers 版本**：WebSocket 路径是 `/api/ws/sessions/:sessionId`，用于任务会话，不是项目列表

**调用位置**：
- `frontend/src/hooks/useProjects.ts:18` - 定义 endpoint 为 `/api/projects/stream/ws`
- `frontend/src/hooks/useJsonPatchWsStream.ts` - 通用 WebSocket 流 hook

**修复方案**：
```typescript
// 方案 A：远程模式使用 HTTP 轮询
// useProjects 在远程模式下使用 useQuery 轮询 /api/projects

// 方案 B：Workers 添加项目流 WebSocket
// 在 workers 中实现项目列表的实时同步（复杂度高）
```

## 推荐修复策略

### 策略：前端模式检测 + Workers 兼容端点

#### 步骤 1：创建远程 API 配置 hook

**文件**：`frontend/src/hooks/useRemoteConfig.ts`

```typescript
import { isRemoteApiEnabled } from '@/lib/api';
import { UserSystemInfo, Config } from 'shared/types';

// Web 版本的默认配置
const DEFAULT_WEB_CONFIG: Partial<UserSystemInfo> = {
  config: {
    // 基本配置默认值
    disclaimer_acknowledged: true,
    onboarding_acknowledged: true,
    analytics_enabled: false,
    // ... 其他必要的默认值
  } as Config,
  environment: {
    os_type: 'web',
    os_version: 'browser',
    os_architecture: 'wasm',
    bitness: '64',
  },
  executors: {},
  capabilities: {},
  analytics_user_id: '',
  login_status: { logged_in: false },
};

export function getDefaultConfigForMode(): Partial<UserSystemInfo> | null {
  if (isRemoteApiEnabled) {
    return DEFAULT_WEB_CONFIG;
  }
  return null; // 本地模式使用真实 API
}
```

#### 步骤 2：修改 ConfigProvider

**文件**：`frontend/src/components/ConfigProvider.tsx`

修改 `useQuery` 调用，远程模式下返回默认配置或跳过本地特有功能：

```typescript
import { isRemoteApiEnabled } from '@/lib/api';

const { data: userSystemInfo, isLoading } = useQuery({
  queryKey: ['user-system'],
  queryFn: async () => {
    if (isRemoteApiEnabled) {
      // Web 版本：返回默认配置，不调用本地 API
      return DEFAULT_WEB_CONFIG as UserSystemInfo;
    }
    return configApi.getConfig();
  },
  staleTime: 5 * 60 * 1000,
});
```

#### 步骤 3：修改 useProjects hook

**文件**：`frontend/src/hooks/useProjects.ts`

远程模式使用 HTTP 轮询代替 WebSocket：

```typescript
import { useQuery } from '@tanstack/react-query';
import { isRemoteApiEnabled } from '@/lib/api';

export function useProjects(): UseProjectsResult {
  // 远程模式：使用 HTTP 轮询
  if (isRemoteApiEnabled) {
    return useProjectsRemote();
  }

  // 本地模式：使用 WebSocket
  return useProjectsLocal();
}

function useProjectsRemote(): UseProjectsResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const result = await response.json();
      return result.data as Project[];
    },
    refetchInterval: 5000, // 5秒轮询
  });

  return {
    projects: data ?? [],
    projectsById: Object.fromEntries((data ?? []).map(p => [p.id, p])),
    isLoading,
    isConnected: true,
    error: error as Error | null,
  };
}

function useProjectsLocal(): UseProjectsResult {
  // 原有的 WebSocket 实现
  const endpoint = '/api/projects/stream/ws';
  // ...
}
```

#### 步骤 4：（可选）Workers 添加兼容端点

**文件**：`workers/src/index.ts`

添加 `/api/info` 端点返回 Web 版默认配置：

```typescript
// Web 版本的系统信息端点
app.get('/api/info', (c) => {
  return c.json({
    success: true,
    data: {
      config: {
        disclaimer_acknowledged: true,
        onboarding_acknowledged: true,
        analytics_enabled: false,
        language: 'en',
        // ... 基本默认值
      },
      environment: {
        os_type: 'web',
        os_version: 'browser',
        os_architecture: 'wasm',
        bitness: '64',
      },
      executors: {},
      capabilities: {},
      analytics_user_id: '',
      login_status: { logged_in: false },
    },
  });
});

// 空的 profiles 端点
app.get('/api/profiles', (c) => {
  return c.json({
    success: true,
    data: {
      content: '{}',
      path: '',
    },
  });
});
```

## 相关文件清单

### 需要修改的前端文件
- `frontend/src/lib/api.ts` - API 配置和 isRemoteApiEnabled
- `frontend/src/components/ConfigProvider.tsx` - 系统配置 Provider
- `frontend/src/hooks/useProjects.ts` - 项目列表 hook
- `frontend/src/hooks/useJsonPatchWsStream.ts` - WebSocket 流 hook

### 需要修改的 Workers 文件
- `workers/src/index.ts` - 添加兼容端点

### 参考文件（只读）
- `crates/server/src/routes/config.rs` - 本地版 API 实现
- `frontend/src/contexts/ProjectContext.tsx` - 项目上下文

## 验证步骤

1. **本地测试**：`pnpm run dev` 确保本地版本仍然正常工作
2. **Workers 测试**：`cd workers && pnpm run dev` 启动 Workers 开发服务器
3. **前端连接 Workers**：设置 `VITE_API_BASE_URL=http://localhost:8787` 测试 Web 模式
4. **检查控制台**：确保没有 404 错误
5. **功能验证**：
   - 项目列表正常加载
   - 无 "Connection failed" 错误
   - Logo 清晰可见

## 注意事项

1. **类型兼容**：确保 `UserSystemInfo` 类型在前端和后端保持兼容
2. **渐进增强**：Web 版本功能可以比本地版本少，但核心功能必须可用
3. **错误处理**：API 失败时显示友好的错误提示，而不是红色 "Connection failed"
4. **测试覆盖**：修改后运行 `pnpm test` 确保没有破坏现有测试

---

**预计工作量**：中等复杂度，涉及 4-6 个文件的修改
**优先级**：高（影响生产环境用户体验）
