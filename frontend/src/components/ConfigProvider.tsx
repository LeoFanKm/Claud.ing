import { useUser } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BaseAgentCapability,
  Config,
  Environment,
  ExecutorConfig,
  LoginStatus,
  UserSystemInfo,
} from "shared/types";
import { useClerkEnabled } from "../contexts/ClerkContext";
import { updateLanguageFromConfig } from "../i18n/config";
import { configApi, isRemoteApiEnabled } from "../lib/api";

// localStorage key for saving config when not logged in
const LOCAL_CONFIG_KEY = "vk_local_config";

// Helper to get local config from localStorage
function getLocalConfig(): Partial<Config> | null {
  try {
    const stored = localStorage.getItem(LOCAL_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Helper to save config to localStorage
export function saveLocalConfig(config: Partial<Config>): void {
  try {
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error("Failed to save local config:", err);
  }
}

// Default configuration for Web (remote) mode
// These are reasonable defaults when running in browser without local Rust backend
// Note: We use 'as unknown as UserSystemInfo' because the Web version doesn't need
// all the Config fields that the local desktop version requires
const DEFAULT_WEB_CONFIG = {
  config: {
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
  login_status: { status: "loggedout" as const },
} as unknown as UserSystemInfo;

interface UserSystemState {
  config: Config | null;
  environment: Environment | null;
  profiles: Record<string, ExecutorConfig> | null;
  capabilities: Record<string, BaseAgentCapability[]> | null;
  analyticsUserId: string | null;
  loginStatus: LoginStatus | null;
}

interface UserSystemContextType {
  // Full system state
  system: UserSystemState;

  // Hot path - config helpers (most frequently used)
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => void;
  updateAndSaveConfig: (updates: Partial<Config>) => Promise<boolean>;
  saveConfig: () => Promise<boolean>;

  // System data access
  environment: Environment | null;
  profiles: Record<string, ExecutorConfig> | null;
  capabilities: Record<string, BaseAgentCapability[]> | null;
  analyticsUserId: string | null;
  loginStatus: LoginStatus | null;
  setEnvironment: (env: Environment | null) => void;
  setProfiles: (profiles: Record<string, ExecutorConfig> | null) => void;
  setCapabilities: (caps: Record<string, BaseAgentCapability[]> | null) => void;

  // Reload system data
  reloadSystem: () => Promise<void>;

  // State
  loading: boolean;
}

const UserSystemContext = createContext<UserSystemContextType | undefined>(
  undefined
);

interface UserSystemProviderProps {
  children: ReactNode;
}

// Timeout for Clerk loading - prevent infinite loading if Clerk fails to initialize
// Reduced from 5000ms to 2000ms for faster fallback
const CLERK_LOAD_TIMEOUT_MS = 2000;

// Hook that always calls useUser - only use when Clerk is enabled
function useClerkUserInfoWithClerk(): {
  isSignedIn: boolean;
  isLoaded: boolean;
  userId: string | null;
  email: string | null;
} {
  const { user, isSignedIn, isLoaded } = useUser();
  const [timedOut, setTimedOut] = useState(false);
  const mountTimeRef = useRef(Date.now());

  // Set up timeout for Clerk loading
  useEffect(() => {
    if (isLoaded) {
      return;
    }

    const timer = setTimeout(() => {
      const elapsed = Date.now() - mountTimeRef.current;
      // Use warn level which is NOT stripped in production
      console.warn(
        "[ConfigProvider] Clerk loading timed out after",
        elapsed,
        "ms - treating as loaded (not signed in)"
      );
      setTimedOut(true);
    }, CLERK_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isLoaded]);

  // If timed out, treat as loaded but not authenticated
  const effectiveIsLoaded = isLoaded || timedOut;

  return {
    isSignedIn: effectiveIsLoaded ? (isSignedIn ?? false) : false,
    isLoaded: effectiveIsLoaded,
    userId: user?.id ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
  };
}

// Provider component when Clerk is enabled
function UserSystemProviderWithClerk({ children }: UserSystemProviderProps) {
  const queryClient = useQueryClient();
  const clerkUser = useClerkUserInfoWithClerk();

  return (
    <UserSystemProviderInner clerkUser={clerkUser} queryClient={queryClient}>
      {children}
    </UserSystemProviderInner>
  );
}

// Provider component when Clerk is disabled
function UserSystemProviderWithoutClerk({ children }: UserSystemProviderProps) {
  const queryClient = useQueryClient();
  const clerkUser = { isSignedIn: false, isLoaded: true, userId: null, email: null };

  return (
    <UserSystemProviderInner clerkUser={clerkUser} queryClient={queryClient}>
      {children}
    </UserSystemProviderInner>
  );
}

// Inner provider that doesn't call any Clerk hooks
function UserSystemProviderInner({
  children,
  clerkUser,
  queryClient,
}: {
  children: ReactNode;
  clerkUser: { isSignedIn: boolean; isLoaded: boolean; userId: string | null; email: string | null };
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  // In remote mode, only fetch config after Clerk auth has loaded
  // This prevents the config API call from being made before authentication is ready
  const shouldFetchConfig = !isRemoteApiEnabled || clerkUser.isLoaded;

  const { data: userSystemInfo, isLoading } = useQuery({
    queryKey: ["user-system"],
    queryFn: async () => {
      // In remote mode (Web version), fetch config from /api/config
      // This endpoint returns user settings merged with defaults
      if (isRemoteApiEnabled) {
        // Get local config from localStorage (for guests/not-logged-in users)
        const localConfig = getLocalConfig();

        try {
          const webConfig = await configApi.getWebConfig();
          // Merge web config into default structure
          return {
            ...DEFAULT_WEB_CONFIG,
            config: {
              ...DEFAULT_WEB_CONFIG.config,
              ...webConfig,
            },
          } as unknown as UserSystemInfo;
        } catch (error) {
          console.error("Failed to fetch web config, using defaults:", error);
          // When not logged in, merge localStorage config with defaults
          return {
            ...DEFAULT_WEB_CONFIG,
            config: {
              ...DEFAULT_WEB_CONFIG.config,
              ...localConfig,
            },
          } as unknown as UserSystemInfo;
        }
      }
      // In local mode, fetch from Rust backend
      return configApi.getConfig();
    },
    enabled: shouldFetchConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const config = userSystemInfo?.config || null;
  const environment = userSystemInfo?.environment || null;
  const analyticsUserId = userSystemInfo?.analytics_user_id || null;

  // In Web mode with Clerk, derive login status from Clerk user state
  // This ensures login status is always in sync with Clerk authentication
  const loginStatus: LoginStatus | null = useMemo(() => {
    if (isRemoteApiEnabled && clerkUser.isSignedIn && clerkUser.userId) {
      return {
        status: "loggedin" as const,
        profile: {
          user_id: clerkUser.userId,
          username: clerkUser.email?.split("@")[0] || null,
          email: clerkUser.email || "",
          providers: [],
        },
      };
    }
    // Fall back to API response or default
    return userSystemInfo?.login_status || null;
  }, [
    clerkUser.isSignedIn,
    clerkUser.isLoaded,
    clerkUser.userId,
    clerkUser.email,
    userSystemInfo?.login_status,
  ]);
  const profiles =
    (userSystemInfo?.executors as Record<string, ExecutorConfig> | null) ||
    null;
  const capabilities =
    (userSystemInfo?.capabilities as Record<
      string,
      BaseAgentCapability[]
    > | null) || null;

  // Sync language with i18n when config changes
  useEffect(() => {
    if (config?.language) {
      updateLanguageFromConfig(config.language);
    }
  }, [config?.language]);

  const updateConfig = useCallback(
    (updates: Partial<Config>) => {
      queryClient.setQueryData<UserSystemInfo>(["user-system"], (old) => {
        if (!old) return old;
        return {
          ...old,
          config: { ...old.config, ...updates },
        };
      });
    },
    [queryClient]
  );

  const saveConfig = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    try {
      await configApi.saveConfig(config);
      return true;
    } catch (err) {
      console.error("Error saving config:", err);
      return false;
    }
  }, [config]);

  const updateAndSaveConfig = useCallback(
    async (updates: Partial<Config>): Promise<boolean> => {
      if (!config) return false;

      const newConfig = { ...config, ...updates };
      updateConfig(updates);

      try {
        const saved = await configApi.saveConfig(newConfig);
        queryClient.setQueryData<UserSystemInfo>(["user-system"], (old) => {
          if (!old) return old;
          return {
            ...old,
            config: saved,
          };
        });
        return true;
      } catch (err) {
        console.error("Error saving config:", err);
        queryClient.invalidateQueries({ queryKey: ["user-system"] });
        return false;
      }
    },
    [config, queryClient, updateConfig]
  );

  const reloadSystem = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["user-system"] });
  }, [queryClient]);

  const setEnvironment = useCallback(
    (env: Environment | null) => {
      queryClient.setQueryData<UserSystemInfo>(["user-system"], (old) => {
        if (!(old && env)) return old;
        return { ...old, environment: env };
      });
    },
    [queryClient]
  );

  const setProfiles = useCallback(
    (newProfiles: Record<string, ExecutorConfig> | null) => {
      queryClient.setQueryData<UserSystemInfo>(["user-system"], (old) => {
        if (!(old && newProfiles)) return old;
        return {
          ...old,
          executors: newProfiles as unknown as UserSystemInfo["executors"],
        };
      });
    },
    [queryClient]
  );

  const setCapabilities = useCallback(
    (newCapabilities: Record<string, BaseAgentCapability[]> | null) => {
      queryClient.setQueryData<UserSystemInfo>(["user-system"], (old) => {
        if (!(old && newCapabilities)) return old;
        return { ...old, capabilities: newCapabilities };
      });
    },
    [queryClient]
  );

  // Compute loading state:
  // - In remote mode: loading if Clerk hasn't loaded OR query is loading
  // - In local mode: loading only if query is loading
  const effectiveLoading = isRemoteApiEnabled
    ? !clerkUser.isLoaded || (isLoading && !userSystemInfo)
    : isLoading;

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<UserSystemContextType>(
    () => ({
      system: {
        config,
        environment,
        profiles,
        capabilities,
        analyticsUserId,
        loginStatus,
      },
      config,
      environment,
      profiles,
      capabilities,
      analyticsUserId,
      loginStatus,
      updateConfig,
      saveConfig,
      updateAndSaveConfig,
      setEnvironment,
      setProfiles,
      setCapabilities,
      reloadSystem,
      loading: effectiveLoading,
    }),
    [
      config,
      environment,
      profiles,
      capabilities,
      analyticsUserId,
      loginStatus,
      updateConfig,
      saveConfig,
      updateAndSaveConfig,
      reloadSystem,
      effectiveLoading,
      setEnvironment,
      setProfiles,
      setCapabilities,
    ]
  );

  return (
    <UserSystemContext.Provider value={value}>
      {children}
    </UserSystemContext.Provider>
  );
}

// Main export - chooses correct provider based on Clerk status
export function UserSystemProvider({ children }: UserSystemProviderProps) {
  const isClerkEnabled = useClerkEnabled();

  if (isClerkEnabled) {
    return <UserSystemProviderWithClerk>{children}</UserSystemProviderWithClerk>;
  }

  return <UserSystemProviderWithoutClerk>{children}</UserSystemProviderWithoutClerk>;
}

export function useUserSystem() {
  const context = useContext(UserSystemContext);
  if (context === undefined) {
    throw new Error("useUserSystem must be used within a UserSystemProvider");
  }
  return context;
}
