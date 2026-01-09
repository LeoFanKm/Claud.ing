console.log('[main.tsx] Script starting...');

import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/index.css';
import { ClickToComponent } from 'click-to-react-component';
import { VibeKanbanWebCompanion } from 'vibe-kanban-web-companion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { ClerkProvider } from '@clerk/clerk-react';
import { ClerkEnabledProvider } from './contexts/ClerkContext';
// Import modal type definitions
import './types/modals';
// Import auth initialization
import { initAuthSettled } from './lib/api';

console.log('[main.tsx] All imports loaded successfully');

// Initialize auth settled promise immediately
// This ensures API requests wait for auth state to be determined
// before proceeding, preventing 401 errors from race conditions
initAuthSettled();
console.log('[main.tsx] Auth settled promise initialized');

// Initialize PostHog for analytics
if (
  import.meta.env.VITE_POSTHOG_API_KEY &&
  import.meta.env.VITE_POSTHOG_API_ENDPOINT
) {
  posthog.init(import.meta.env.VITE_POSTHOG_API_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_API_ENDPOINT,
    capture_pageview: false,
    capture_pageleave: true,
    capture_performance: true,
    autocapture: false,
    opt_out_capturing_by_default: true,
  });
  console.log('[main.tsx] PostHog initialized');
} else {
  console.warn('[main.tsx] PostHog API key or endpoint not set. Analytics will be disabled.');
}

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});
console.log('[main.tsx] QueryClient created');

// Check if Clerk is enabled (has publishable key)
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isClerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY);
console.log('[main.tsx] Clerk enabled:', isClerkEnabled, 'Key exists:', !!CLERK_PUBLISHABLE_KEY);

// Global error boundary - catches ALL React errors including from ClerkProvider
class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; name: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('[GlobalErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary] Error details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: 'system-ui',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          minHeight: '100vh'
        }}>
          <h1 style={{ color: '#ff6b6b' }}>Something went wrong ({this.props.name})</h1>
          <pre style={{
            backgroundColor: '#2a2a2a',
            padding: '20px',
            borderRadius: '8px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loading fallback for Suspense
function LoadingFallback({ message }: { message: string }) {
  console.log('[LoadingFallback] Showing:', message);
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui',
      backgroundColor: '#faf9f6',
      color: '#333'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid #e5e5e5',
        borderTopColor: '#2563eb',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{ marginTop: '16px', fontSize: '14px', opacity: 0.7 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Inner app content
function AppContent() {
  console.log('[AppContent] Rendering...');
  return (
    <>
      <ClickToComponent />
      <VibeKanbanWebCompanion />
      <App />
    </>
  );
}

// App wrapper that conditionally includes ClerkProvider
function AppWithProviders() {
  console.log('[AppWithProviders] Rendering, isClerkEnabled:', isClerkEnabled);

  // Core app wrapped in providers that always work
  const coreApp = (
    <GlobalErrorBoundary name="App">
      <Suspense fallback={<LoadingFallback message="Loading app..." />}>
        <AppContent />
      </Suspense>
    </GlobalErrorBoundary>
  );

  const withQueryAndPosthog = (
    <QueryClientProvider client={queryClient}>
      <PostHogProvider client={posthog}>
        {coreApp}
      </PostHogProvider>
    </QueryClientProvider>
  );

  // If Clerk is enabled, wrap with ClerkProvider
  if (isClerkEnabled) {
    console.log('[AppWithProviders] Wrapping with ClerkProvider');
    return (
      <GlobalErrorBoundary name="ClerkProvider">
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
          <ClerkEnabledProvider enabled={true}>
            {withQueryAndPosthog}
          </ClerkEnabledProvider>
        </ClerkProvider>
      </GlobalErrorBoundary>
    );
  }

  // If Clerk is not enabled, just use ClerkEnabledProvider with enabled=false
  console.log('[AppWithProviders] No Clerk, using ClerkEnabledProvider(enabled=false)');
  return (
    <ClerkEnabledProvider enabled={false}>
      {withQueryAndPosthog}
    </ClerkEnabledProvider>
  );
}

console.log('[main.tsx] About to render React app...');

try {
  const rootElement = document.getElementById('root');
  console.log('[main.tsx] Root element found:', !!rootElement);

  if (!rootElement) {
    throw new Error('Root element not found!');
  }

  const root = ReactDOM.createRoot(rootElement);
  console.log('[main.tsx] ReactDOM.createRoot called');

  root.render(
    <React.StrictMode>
      <GlobalErrorBoundary name="Root">
        <AppWithProviders />
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
  console.log('[main.tsx] render() called successfully');
} catch (error) {
  console.error('[main.tsx] Fatal error during initialization:', error);
  // Show error on page
  document.body.innerHTML = `
    <div style="padding: 40px; font-family: system-ui; background: #1a1a1a; color: #fff; min-height: 100vh;">
      <h1 style="color: #ff6b6b;">Failed to initialize app</h1>
      <pre style="background: #2a2a2a; padding: 20px; border-radius: 8px; white-space: pre-wrap;">
${error instanceof Error ? error.message + '\n\n' + error.stack : String(error)}
      </pre>
    </div>
  `;
}
