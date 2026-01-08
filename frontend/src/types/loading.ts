/**
 * @file loading.ts
 * @description Unified loading state type definitions for consistent async state handling
 *
 * @position types/loading - Core type definitions for loading states
 * @lastModified 2026-01-05
 */

/**
 * Discriminated union for precise loading state management.
 * Use this when you need to distinguish between idle, loading, success, and error states.
 *
 * @example
 * ```tsx
 * const [state, setState] = useState<LoadingState<User>>({ status: 'idle' });
 *
 * // In component
 * if (state.status === 'loading') return <Spinner />;
 * if (state.status === 'error') return <Error message={state.error} />;
 * if (state.status === 'success') return <UserCard user={state.data} />;
 * ```
 */
export type LoadingState<T = void, E = string> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: E };

/**
 * Simple loading state for boolean-based patterns.
 * Compatible with existing `isLoading` patterns in hooks.
 */
export interface SimpleLoadingState<E = Error | null> {
  isLoading: boolean;
  error: E;
}

/**
 * Extended loading state with connection info.
 * Used by hooks that track WebSocket or API connection status.
 */
export interface ConnectedLoadingState<E = Error | null>
  extends SimpleLoadingState<E> {
  isConnected: boolean;
}

/**
 * Async operation state for mutations.
 * Compatible with TanStack Query mutation patterns.
 */
export interface AsyncOperationState {
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isIdle<T, E>(
  state: LoadingState<T, E>
): state is { status: "idle" } {
  return state.status === "idle";
}

export function isLoading<T, E>(
  state: LoadingState<T, E>
): state is { status: "loading" } {
  return state.status === "loading";
}

export function isSuccess<T, E>(
  state: LoadingState<T, E>
): state is { status: "success"; data: T } {
  return state.status === "success";
}

export function isError<T, E>(
  state: LoadingState<T, E>
): state is { status: "error"; error: E } {
  return state.status === "error";
}

// ============================================================================
// Factory Functions
// ============================================================================

export const LoadingStateFactory = {
  idle: <T, E = string>(): LoadingState<T, E> => ({ status: "idle" }),
  loading: <T, E = string>(): LoadingState<T, E> => ({ status: "loading" }),
  success: <T, E = string>(data: T): LoadingState<T, E> => ({
    status: "success",
    data,
  }),
  error: <T, E = string>(error: E): LoadingState<T, E> => ({
    status: "error",
    error,
  }),
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract the data type from a LoadingState
 */
export type ExtractLoadingData<S> =
  S extends LoadingState<infer T, unknown> ? T : never;

/**
 * Extract the error type from a LoadingState
 */
export type ExtractLoadingError<S> =
  S extends LoadingState<unknown, infer E> ? E : never;

/**
 * Loading status literal type
 */
export type LoadingStatus = LoadingState<unknown, unknown>["status"];
