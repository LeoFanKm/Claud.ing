import { useQuery } from "@tanstack/react-query";
import { oauthApi } from "@/lib/api";

interface UseAuthStatusOptions {
  enabled: boolean;
}

/**
 * Hook to poll OAuth authentication status.
 * NOTE: This hook intentionally does NOT depend on useAuth/useUserSystem
 * so it can be used on the Landing page outside UserSystemProvider.
 */
export function useAuthStatus(options: UseAuthStatusOptions) {
  const query = useQuery({
    queryKey: ["auth", "status"],
    queryFn: () => oauthApi.status(),
    enabled: options.enabled,
    refetchInterval: options.enabled ? 1000 : false,
    retry: 3,
    staleTime: 0, // Always fetch fresh data when enabled
  });

  return query;
}
