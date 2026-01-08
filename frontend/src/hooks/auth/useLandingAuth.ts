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

import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useClerkEnabled } from "@/contexts/ClerkContext";

/**
 * Lightweight auth hook for Landing page that never blocks rendering.
 * Unlike useAuth from ConfigProvider, this hook:
 * 1. Doesn't depend on UserSystemProvider context
 * 2. Returns immediately without waiting for Clerk to fully initialize
 * 3. Safe to use outside UserSystemProvider wrapper
 *
 * @returns Auth state with isSignedIn, isLoaded, and isLoading flags
 */
export function useLandingAuth() {
  const isClerkEnabled = useClerkEnabled();

  // Always call the Clerk auth hook (hooks must be called unconditionally)
  // This works because Landing is still wrapped in ClerkProvider from main.tsx
  const clerkAuth = useClerkAuth();

  // If Clerk is disabled, return "not signed in" state
  if (!isClerkEnabled) {
    return {
      isSignedIn: false,
      isLoaded: true,
      isLoading: false,
    };
  }

  // When Clerk is enabled, return the actual Clerk auth state
  return {
    isSignedIn: clerkAuth.isSignedIn ?? false,
    isLoaded: clerkAuth.isLoaded,
    isLoading: !clerkAuth.isLoaded,
  };
}
