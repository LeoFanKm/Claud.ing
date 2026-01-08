import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { I18nextProvider } from "react-i18next";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { NormalLayout } from "@/components/layout/NormalLayout";
import { Loader } from "@/components/ui/loader";
import { useApiAuth, useAuth } from "@/hooks";
import { usePreviousPath } from "@/hooks/usePreviousPath";
import i18n from "@/i18n";
import { isRemoteApiEnabled } from "@/lib/api";
// Direct import for Landing to bypass lazy loading issue
import { Landing } from "@/pages/Landing";

// Lazy load pages for code splitting (except Landing)
const Projects = lazy(() =>
  import("@/pages/Projects").then((m) => ({ default: m.Projects }))
);
const ProjectTasks = lazy(() =>
  import("@/pages/ProjectTasks").then((m) => ({ default: m.ProjectTasks }))
);
const FullAttemptLogsPage = lazy(() =>
  import("@/pages/FullAttemptLogs").then((m) => ({
    default: m.FullAttemptLogsPage,
  }))
);
const Docs = lazy(() =>
  import("@/pages/Docs").then((m) => ({ default: m.Docs }))
);

// Lazy load settings pages
const SettingsLayout = lazy(() =>
  import("@/pages/settings/").then((m) => ({ default: m.SettingsLayout }))
);
const GeneralSettings = lazy(() =>
  import("@/pages/settings/").then((m) => ({ default: m.GeneralSettings }))
);
const ProjectSettings = lazy(() =>
  import("@/pages/settings/").then((m) => ({ default: m.ProjectSettings }))
);
const OrganizationSettings = lazy(() =>
  import("@/pages/settings/").then((m) => ({
    default: m.OrganizationSettings,
  }))
);
const AgentSettings = lazy(() =>
  import("@/pages/settings/").then((m) => ({ default: m.AgentSettings }))
);
const McpSettings = lazy(() =>
  import("@/pages/settings/").then((m) => ({ default: m.McpSettings }))
);

// Page loading fallback
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader message="Loading..." size={32} />
  </div>
);

import NiceModal from "@ebay/nice-modal-react";
import { HotkeysProvider } from "react-hotkeys-hook";
import { ThemeMode } from "shared/types";
import {
  UserSystemProvider,
  useUserSystem,
} from "@/components/ConfigProvider";
import { DisclaimerDialog } from "@/components/dialogs/global/DisclaimerDialog";
import { OnboardingDialog } from "@/components/dialogs/global/OnboardingDialog";
import { ReleaseNotesDialog } from "@/components/dialogs/global/ReleaseNotesDialog";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { ClickedElementsProvider } from "./contexts/ClickedElementsProvider";

// Global fallback timeout to prevent infinite loading
// Shorter timeout for web mode since we want fast initial render
const GLOBAL_LOAD_TIMEOUT_MS = isRemoteApiEnabled ? 3000 : 10000;

// Simple ErrorBoundary for Landing page
class LandingErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error("[LandingErrorBoundary] Caught error:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[LandingErrorBoundary] Error details:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
          <h1 className="mb-4 text-xl font-bold text-destructive">
            Failed to load landing page
          </h1>
          <p className="mb-4 text-muted-foreground">
            {this.state.error?.message || "Unknown error"}
          </p>
          <button
            className="rounded bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Config-dependent content wrapper
 * Only shows loader for routes that actually need the config
 * In web/remote mode: Uses aggressive timeout to prevent infinite loading
 */
function ConfigDependentContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { config, updateAndSaveConfig, loading } = useUserSystem();
  const { isSignedIn } = useAuth();
  const [forceShow, setForceShow] = useState(false);
  // Use ref to track mount time - survives re-renders
  const mountTimeRef = useRef(Date.now());

  // Initialize API authentication with Clerk
  useApiAuth();

  // Track previous path for back navigation
  usePreviousPath();

  // Force re-render counter to ensure elapsed time check runs
  const [, forceRender] = useState(0);

  // Global fallback: force show content after timeout to prevent infinite loading
  // Uses ref-based time tracking to survive re-renders
  useEffect(() => {
    if (!loading) {
      return;
    }

    // Check if we've already exceeded timeout (handles re-render scenarios)
    const elapsed = Date.now() - mountTimeRef.current;
    if (elapsed >= GLOBAL_LOAD_TIMEOUT_MS) {
      setForceShow(true);
      return;
    }

    // Set timer for remaining time
    const remainingTime = GLOBAL_LOAD_TIMEOUT_MS - elapsed;
    const timer = setTimeout(() => {
      setForceShow(true);
    }, remainingTime);

    // Also set up a periodic re-render to ensure elapsed check runs
    // This handles edge cases where state updates might be blocked
    const interval = setInterval(() => {
      forceRender((n) => n + 1);
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loading]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    const showNextStep = async () => {
      // 1) Disclaimer - first step
      if (!config.disclaimer_acknowledged) {
        await DisclaimerDialog.show();
        if (!cancelled) {
          await updateAndSaveConfig({ disclaimer_acknowledged: true });
        }
        DisclaimerDialog.hide();
        return;
      }

      // 2) Onboarding - configure executor and editor
      if (!config.onboarding_acknowledged) {
        const result = await OnboardingDialog.show();
        if (!cancelled) {
          await updateAndSaveConfig({
            onboarding_acknowledged: true,
            executor_profile: result.profile,
            editor: result.editor,
          });
        }
        OnboardingDialog.hide();
        return;
      }

      // 3) Release notes - last step
      if (config.show_release_notes) {
        await ReleaseNotesDialog.show();
        if (!cancelled) {
          await updateAndSaveConfig({ show_release_notes: false });
        }
        ReleaseNotesDialog.hide();
        return;
      }
    };

    showNextStep();

    return () => {
      cancelled = true;
    };
  }, [config, isSignedIn, updateAndSaveConfig]);

  // Calculate if we should force show based on elapsed time
  // This check runs on every render to catch cases where state updates are blocked
  const elapsed = Date.now() - mountTimeRef.current;
  const shouldForceShow = forceShow || elapsed >= GLOBAL_LOAD_TIMEOUT_MS;

  // AGGRESSIVE FIX: In web/remote mode, NEVER block rendering
  // Just show content immediately - config will load in background
  if (isRemoteApiEnabled) {
    return <>{children}</>;
  }

  // In local mode: Wait for config to load properly (with timeout fallback)
  if (loading && !shouldForceShow) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader message="Loading..." size={32} />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Landing page content - renders immediately without waiting for config
 * Landing is directly imported (not lazy) to bypass React.lazy() Suspense issues
 */
function LandingContent() {
  // Still initialize these hooks for consistency
  useApiAuth();
  usePreviousPath();

  console.log("[LandingContent] Rendering Landing directly (no lazy)...");

  return (
    <LandingErrorBoundary>
      <Landing />
    </LandingErrorBoundary>
  );
}

/**
 * Landing route wrapper - renders OUTSIDE UserSystemProvider for instant loading.
 * This wrapper provides minimal necessary providers without waiting for Clerk/Config.
 */
function LandingRouteWrapper() {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider initialTheme={ThemeMode.SYSTEM}>
        <NiceModal.Provider>
          <div className="flex h-screen flex-col bg-background">
            <LandingContent />
          </div>
        </NiceModal.Provider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

/**
 * Main app routes - config-dependent routes wrapped in UserSystemProvider
 * Landing page is handled separately at App level (outside UserSystemProvider)
 */
function AppRoutesWithConfig() {
  // All non-landing routes wait for config
  return (
    <ConfigDependentContent>
      <AppContent />
    </ConfigDependentContent>
  );
}

/**
 * Main app content with all routes (for config-dependent pages)
 */
function AppContent() {
  const { config } = useUserSystem();

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider initialTheme={config?.theme || ThemeMode.SYSTEM}>
        <SearchProvider>
          <div className="flex h-screen flex-col bg-background">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* VS Code full-page logs route (outside NormalLayout for minimal UI) */}
                <Route
                  element={<FullAttemptLogsPage />}
                  path="/projects/:projectId/tasks/:taskId/attempts/:attemptId/full"
                />

                <Route element={<NormalLayout />}>
                  <Route element={<Docs />} path="/docs" />
                  <Route element={<Projects />} path="/projects" />
                  <Route element={<Projects />} path="/projects/:projectId" />
                  <Route
                    element={<ProjectTasks />}
                    path="/projects/:projectId/tasks"
                  />
                  <Route element={<SettingsLayout />} path="/settings/*">
                    <Route element={<Navigate replace to="general" />} index />
                    <Route element={<GeneralSettings />} path="general" />
                    <Route element={<ProjectSettings />} path="projects" />
                    <Route
                      element={<OrganizationSettings />}
                      path="organizations"
                    />
                    <Route element={<AgentSettings />} path="agents" />
                    <Route element={<McpSettings />} path="mcp" />
                  </Route>
                  <Route
                    element={<Navigate replace to="/settings/mcp" />}
                    path="/mcp-servers"
                  />
                  <Route
                    element={<ProjectTasks />}
                    path="/projects/:projectId/tasks/:taskId"
                  />
                  <Route
                    element={<ProjectTasks />}
                    path="/projects/:projectId/tasks/:taskId/attempts/:attemptId"
                  />
                  {/* Catch-all route - redirect unknown paths to /projects */}
                  <Route element={<Navigate replace to="/projects" />} path="*" />
                </Route>
              </Routes>
            </Suspense>
          </div>
        </SearchProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page renders OUTSIDE UserSystemProvider for instant load */}
        <Route element={<LandingRouteWrapper />} path="/" />

        {/* All other routes go through UserSystemProvider */}
        <Route
          element={
            <UserSystemProvider>
              <ClickedElementsProvider>
                <ProjectProvider>
                  <HotkeysProvider initiallyActiveScopes={["*", "global", "kanban"]}>
                    <NiceModal.Provider>
                      <AppRoutesWithConfig />
                    </NiceModal.Provider>
                  </HotkeysProvider>
                </ProjectProvider>
              </ClickedElementsProvider>
            </UserSystemProvider>
          }
          path="/*"
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
