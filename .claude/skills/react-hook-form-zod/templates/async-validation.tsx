/**
 * Async Validation Example
 *
 * Demonstrates:
 * - Async validation with API calls
 * - Debouncing to prevent excessive requests
 * - Loading states
 * - Error handling for async validation
 * - Request cancellation
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

/**
 * Pattern 1: Async Validation in Zod Schema
 */
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must not exceed 20 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores"
  )
  .refine(
    async (username) => {
      // Check if username is available via API
      const response = await fetch(
        `/api/check-username?username=${encodeURIComponent(username)}`
      );
      const { available } = await response.json();
      return available;
    },
    {
      message: "Username is already taken",
    }
  );

const signupSchemaWithAsync = z.object({
  username: usernameSchema,
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormData = z.infer<typeof signupSchemaWithAsync>;

export function AsyncValidationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValidating },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchemaWithAsync),
    mode: "onBlur", // Validate on blur to avoid validating on every keystroke
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    console.log("Form data:", data);
  };

  return (
    <form
      className="mx-auto max-w-md space-y-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      <h2 className="font-bold text-2xl">Sign Up</h2>

      <div>
        <label className="mb-1 block font-medium text-sm" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          {...register("username")}
          className="w-full rounded-md border px-3 py-2"
        />
        {isValidating && (
          <span className="mt-1 block text-blue-600 text-sm">
            Checking availability...
          </span>
        )}
        {errors.username && (
          <span className="mt-1 block text-red-600 text-sm" role="alert">
            {errors.username.message}
          </span>
        )}
      </div>

      <div>
        <label className="mb-1 block font-medium text-sm" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register("email")}
          className="w-full rounded-md border px-3 py-2"
        />
        {errors.email && (
          <span className="mt-1 block text-red-600 text-sm" role="alert">
            {errors.email.message}
          </span>
        )}
      </div>

      <div>
        <label className="mb-1 block font-medium text-sm" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          {...register("password")}
          className="w-full rounded-md border px-3 py-2"
        />
        {errors.password && (
          <span className="mt-1 block text-red-600 text-sm" role="alert">
            {errors.password.message}
          </span>
        )}
      </div>

      <button
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
        disabled={isSubmitting || isValidating}
        type="submit"
      >
        {isSubmitting ? "Signing up..." : "Sign Up"}
      </button>
    </form>
  );
}

/**
 * Pattern 2: Manual Async Validation with Debouncing and Cancellation
 * Better performance - more control over when validation happens
 */
const manualValidationSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must not exceed 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  email: z.string().email("Invalid email address"),
});

type ManualValidationData = z.infer<typeof manualValidationSchema>;

export function DebouncedAsyncValidationForm() {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ManualValidationData>({
    resolver: zodResolver(manualValidationSchema),
    defaultValues: {
      username: "",
      email: "",
    },
  });

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const username = watch("username");
  const email = watch("email");

  // Debounced username validation
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Skip if username is too short (already handled by Zod)
    if (!username || username.length < 3) {
      setIsCheckingUsername(false);
      return;
    }

    // Debounce: wait 500ms after user stops typing
    timeoutRef.current = setTimeout(async () => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setIsCheckingUsername(true);
      clearErrors("username");

      try {
        const response = await fetch(
          `/api/check-username?username=${encodeURIComponent(username)}`,
          { signal: abortControllerRef.current.signal }
        );

        const { available } = await response.json();

        if (!available) {
          setError("username", {
            type: "async",
            message: "Username is already taken",
          });
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Username check error:", error);
        }
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [username, setError, clearErrors]);

  // Debounced email validation
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Basic email validation first (handled by Zod)
    if (!(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      setIsCheckingEmail(false);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setIsCheckingEmail(true);
      clearErrors("email");

      try {
        const response = await fetch(
          `/api/check-email?email=${encodeURIComponent(email)}`
        );

        const { available } = await response.json();

        if (!available) {
          setError("email", {
            type: "async",
            message: "Email is already registered",
          });
        }
      } catch (error) {
        console.error("Email check error:", error);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 500);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [email, setError, clearErrors]);

  const onSubmit = async (data: ManualValidationData) => {
    // Final check before submission
    if (isCheckingUsername || isCheckingEmail) {
      return;
    }

    console.log("Form data:", data);
  };

  return (
    <form
      className="mx-auto max-w-md space-y-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      <h2 className="font-bold text-2xl">Create Account</h2>

      <div>
        <label className="mb-1 block font-medium text-sm" htmlFor="username">
          Username
        </label>
        <div className="relative">
          <input
            id="username"
            {...register("username")}
            className="w-full rounded-md border px-3 py-2"
          />
          {isCheckingUsername && (
            <div className="absolute top-2.5 right-3">
              <svg
                className="h-5 w-5 animate-spin text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  fill="currentColor"
                />
              </svg>
            </div>
          )}
        </div>
        {errors.username && (
          <span className="mt-1 block text-red-600 text-sm" role="alert">
            {errors.username.message}
          </span>
        )}
        {!errors.username && username.length >= 3 && !isCheckingUsername && (
          <span className="mt-1 block text-green-600 text-sm">
            Username is available ✓
          </span>
        )}
      </div>

      <div>
        <label className="mb-1 block font-medium text-sm" htmlFor="email">
          Email
        </label>
        <div className="relative">
          <input
            id="email"
            type="email"
            {...register("email")}
            className="w-full rounded-md border px-3 py-2"
          />
          {isCheckingEmail && (
            <div className="absolute top-2.5 right-3">
              <svg
                className="h-5 w-5 animate-spin text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  fill="currentColor"
                />
              </svg>
            </div>
          )}
        </div>
        {errors.email && (
          <span className="mt-1 block text-red-600 text-sm" role="alert">
            {errors.email.message}
          </span>
        )}
        {!errors.email && email && !isCheckingEmail && (
          <span className="mt-1 block text-green-600 text-sm">
            Email is available ✓
          </span>
        )}
      </div>

      <button
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
        disabled={isSubmitting || isCheckingUsername || isCheckingEmail}
        type="submit"
      >
        {isSubmitting ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}

/**
 * Mock API endpoints for testing
 */
export async function checkUsernameAvailability(
  username: string
): Promise<boolean> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock: usernames starting with 'test' are taken
  return !username.toLowerCase().startsWith("test");
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock: emails with 'test' are taken
  return !email.toLowerCase().includes("test");
}
