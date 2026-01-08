import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { Project } from "shared/types";
import { isRemoteApiEnabled, projectsApi } from "@/lib/api";
import { useJsonPatchWsStream } from "./useJsonPatchWsStream";
import { useAuth } from "./auth/useAuth";

type ProjectsState = {
  projects: Record<string, Project>;
};

export interface UseProjectsResult {
  projects: Project[];
  projectsById: Record<string, Project>;
  isLoading: boolean;
  isConnected: boolean;
  error: Error | null;
}

/**
 * Hook for fetching and managing projects list
 * - In local mode: Uses WebSocket with JSON Patch for real-time updates
 * - In remote mode: Uses HTTP polling for compatibility with Workers API
 */
export function useProjects(): UseProjectsResult {
  // WebSocket endpoint for local mode
  const wsEndpoint = "/api/projects/stream/ws";

  const initialData = useCallback((): ProjectsState => ({ projects: {} }), []);

  // Get authentication state for remote mode
  // Uses safe useAuth hook that doesn't depend on ClerkProvider
  const auth = useAuth();
  const isAuthenticated = auth.isSignedIn;
  const isAuthLoaded = auth.isLoaded;

  // Local mode: WebSocket stream (disabled in remote mode)
  const {
    data: wsData,
    isConnected: wsConnected,
    error: wsError,
  } = useJsonPatchWsStream<ProjectsState>(
    wsEndpoint,
    !isRemoteApiEnabled, // Only enabled in local mode
    initialData
  );

  // Remote mode: HTTP polling (disabled in local mode)
  // Only fetch when: remote mode enabled AND auth is loaded AND user is signed in
  const shouldFetchRemote =
    isRemoteApiEnabled && isAuthLoaded && isAuthenticated;
  const {
    data: httpData,
    isLoading: httpLoading,
    error: httpError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getList(),
    refetchInterval: 10_000, // Poll every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
    enabled: shouldFetchRemote,
  });

  // Compute projectsById for HTTP mode (remote)
  const httpProjectsById = useMemo(() => {
    if (!httpData) return {};
    return Object.fromEntries(httpData.map((p) => [p.id, p]));
  }, [httpData]);

  // Compute sorted projects for HTTP mode (remote)
  const httpProjects = useMemo(() => {
    if (!httpData) return [];
    return [...httpData].sort(
      (a, b) =>
        new Date(b.created_at as unknown as string).getTime() -
        new Date(a.created_at as unknown as string).getTime()
    );
  }, [httpData]);

  // Compute projectsById for WebSocket mode (local)
  const wsProjectsById = useMemo(() => wsData?.projects ?? {}, [wsData]);

  // Compute sorted projects for WebSocket mode (local)
  const wsProjects = useMemo(() => {
    return Object.values(wsProjectsById).sort(
      (a, b) =>
        new Date(b.created_at as unknown as string).getTime() -
        new Date(a.created_at as unknown as string).getTime()
    );
  }, [wsProjectsById]);

  // Compute error object for WebSocket mode
  const wsErrorObj = useMemo(
    () => (wsError ? new Error(wsError) : null),
    [wsError]
  );

  // Return results based on mode
  if (isRemoteApiEnabled) {
    // If auth is still loading or user is not signed in, return empty/loading state
    if (!isAuthLoaded) {
      return {
        projects: [],
        projectsById: {},
        isLoading: true,
        isConnected: true,
        error: null,
      };
    }
    if (!isAuthenticated) {
      return {
        projects: [],
        projectsById: {},
        isLoading: false,
        isConnected: true,
        error: null, // Not an error - user just needs to sign in
      };
    }
    return {
      projects: httpProjects,
      projectsById: httpProjectsById,
      isLoading: httpLoading,
      isConnected: true, // HTTP polling is always "connected"
      error: httpError as Error | null,
    };
  }

  return {
    projects: wsData ? wsProjects : [],
    projectsById: wsProjectsById,
    isLoading: !(wsData || wsError),
    isConnected: wsConnected,
    error: wsErrorObj,
  };
}
