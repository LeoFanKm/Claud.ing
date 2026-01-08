/**
 * [INPUT]: 依赖 @clerk/clerk-react 的 useAuth，依赖 @/contexts/ClerkContext 的 useClerkEnabled
 * [OUTPUT]: 对外提供 useApiAuth hook，配置 API 客户端的认证 token getter
 * [POS]: hooks 的认证集成器，连接 Clerk 认证与 API 客户端
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useClerkEnabled } from "@/contexts/ClerkContext";
import {
  clearAuthTokenGetter,
  setAuthPending,
  setAuthTokenGetter,
} from "@/lib/api";

/**
 * Hook to integrate Clerk authentication with the API client.
 * Should be called once at the app root level.
 *
 * When Clerk is enabled, sets up the token getter to fetch Clerk session tokens.
 * When Clerk is disabled, clears the token getter.
 *
 * IMPORTANT: Only sets up token getter after Clerk is fully loaded (isLoaded: true)
 * to prevent getToken() from hanging during initialization.
 */
export function useApiAuth() {
  const isClerkEnabled = useClerkEnabled();

  // 只在 Clerk 启用时获取 getToken
  // 使用条件调用 hook 是安全的，因为 isClerkEnabled 在组件生命周期内不会改变
  let getToken: (() => Promise<string | null>) | null = null;
  let isLoaded = false;

  if (isClerkEnabled) {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const clerkAuth = useClerkAuth();
      // CRITICAL: Only use getToken after Clerk is fully loaded
      // If isLoaded is false, getToken() will hang waiting for initialization
      isLoaded = clerkAuth.isLoaded;

      // Debug: Log Clerk auth state
      console.log("[useApiAuth] Clerk state:", {
        isLoaded: clerkAuth.isLoaded,
        isSignedIn: clerkAuth.isSignedIn,
        userId: clerkAuth.userId,
        hasGetToken: !!clerkAuth.getToken,
      });

      if (isLoaded && clerkAuth.isSignedIn) {
        getToken = clerkAuth.getToken;
      } else if (isLoaded && !clerkAuth.isSignedIn) {
        // User is not signed in - don't set tokenGetter
        console.log("[useApiAuth] User not signed in, skipping token getter");
      }
    } catch {
      // Clerk 未初始化时忽略错误
    }
  }

  useEffect(() => {
    if (isClerkEnabled) {
      if (isLoaded && getToken) {
        // Clerk is loaded - set the token getter
        setAuthTokenGetter(getToken);
        return () => {
          clearAuthTokenGetter();
        };
      }
      // Clerk is enabled but still loading - signal that auth is pending
      // This will make API requests wait for auth to be ready
      setAuthPending();
      return () => {
        clearAuthTokenGetter();
      };
    }
    // Clerk not enabled - clear any pending auth state
    clearAuthTokenGetter();
  }, [isClerkEnabled, isLoaded, getToken]);

  return {
    isAuthenticated: isClerkEnabled && isLoaded && !!getToken,
    isLoading: isClerkEnabled && !isLoaded,
  };
}
