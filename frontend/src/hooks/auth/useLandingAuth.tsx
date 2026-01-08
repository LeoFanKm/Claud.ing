/**
 * @file useLandingAuth.ts
 * @description Lightweight auth hook for Landing page that never blocks rendering.
 * Returns immediately with best-effort auth state without waiting for Clerk initialization.
 *
 * @input None (uses ClerkContext and Clerk hooks internally)
 * @output Auth state object { isSignedIn, isLoaded, isLoading }
 * @position hooks/auth
 *
 * @lastModified 2026-01-08
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useClerkEnabled } from "@/contexts/ClerkContext";

interface LandingAuthState {
  isSignedIn: boolean;
  isLoaded: boolean;
  isLoading: boolean;
}

const defaultAuthState: LandingAuthState = {
  isSignedIn: false,
  isLoaded: true,
  isLoading: false,
};

const LandingAuthContext = createContext<LandingAuthState>(defaultAuthState);

/**
 * Internal component that calls useClerkAuth.
 * Only rendered when Clerk is enabled (ClerkProvider exists).
 */
function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const auth = useClerkAuth();
  const state: LandingAuthState = {
    isSignedIn: auth.isSignedIn ?? false,
    isLoaded: auth.isLoaded,
    isLoading: !auth.isLoaded,
  };
  return (
    <LandingAuthContext.Provider value={state}>
      {children}
    </LandingAuthContext.Provider>
  );
}

/**
 * Provider that safely handles auth state for landing page.
 * When Clerk is enabled, uses ClerkAuthProvider which calls useClerkAuth.
 * When Clerk is disabled, provides default "not signed in" state.
 */
export function LandingAuthProvider({ children }: { children: ReactNode }) {
  const isClerkEnabled = useClerkEnabled();

  if (isClerkEnabled) {
    return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
  }

  // When Clerk is disabled, provide default state without calling any Clerk hooks
  return (
    <LandingAuthContext.Provider value={defaultAuthState}>
      {children}
    </LandingAuthContext.Provider>
  );
}

/**
 * Lightweight auth hook for Landing page that never blocks rendering.
 * Unlike useAuth from ConfigProvider, this hook:
 * 1. Doesn't depend on UserSystemProvider context
 * 2. Returns immediately without waiting for Clerk to fully initialize
 * 3. Safe to use outside UserSystemProvider wrapper
 * 4. Safe to use when Clerk is disabled (no ClerkProvider)
 *
 * IMPORTANT: Components using this hook must be wrapped in LandingAuthProvider.
 *
 * @returns Auth state with isSignedIn, isLoaded, and isLoading flags
 */
export function useLandingAuth() {
  return useContext(LandingAuthContext);
}
