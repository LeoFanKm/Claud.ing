/**
 * [INPUT]: 依赖 @clerk/clerk-react 的 useAuth，依赖 @/contexts/ClerkContext 的 useClerkEnabled
 * [OUTPUT]: 对外提供 useApiAuth hook，配置 API 客户端的认证 token getter
 * [POS]: hooks 的认证集成器，连接 Clerk 认证与 API 客户端
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useClerkEnabled } from "@/contexts/ClerkContext";
import { clearAuthTokenGetter, setAuthTokenGetter } from "@/lib/api";

/**
 * Hook to integrate Clerk authentication with the API client.
 * Should be called once at the app root level.
 *
 * When Clerk is enabled, sets up the token getter to fetch Clerk session tokens.
 * When Clerk is disabled, clears the token getter.
 */
export function useApiAuth() {
  const isClerkEnabled = useClerkEnabled();

  // 只在 Clerk 启用时获取 getToken
  // 使用条件调用 hook 是安全的，因为 isClerkEnabled 在组件生命周期内不会改变
  let getToken: (() => Promise<string | null>) | null = null;

  if (isClerkEnabled) {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const clerkAuth = useClerkAuth();
      getToken = clerkAuth.getToken;
    } catch {
      // Clerk 未初始化时忽略错误
    }
  }

  useEffect(() => {
    if (isClerkEnabled && getToken) {
      // 设置 token getter，API 客户端会在每次请求时调用
      setAuthTokenGetter(getToken);
      return () => {
        clearAuthTokenGetter();
      };
    }
    // Clerk 未启用时清除 token getter
    clearAuthTokenGetter();
  }, [isClerkEnabled, getToken]);

  return { isAuthenticated: isClerkEnabled && !!getToken, isLoading: false };
}
