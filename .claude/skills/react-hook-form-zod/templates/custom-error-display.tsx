/**
 * Custom Error Display Example
 *
 * Demonstrates:
 * - Custom error component
 * - Error summary at top of form
 * - Toast notifications for errors
 * - Inline vs summary error display
 * - Accessible error announcements
 * - Icon-based error styling
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  age: z.number().min(18, "You must be at least 18 years old"),
});

type FormData = z.infer<typeof formSchema>;

/**
 * Custom Error Component
 */
function FormError({
  message,
  icon = true,
}: {
  message: string;
  icon?: boolean;
}) {
  return (
    <div
      className="mt-1 flex items-start gap-2 text-red-600 text-sm"
      role="alert"
    >
      {icon && (
        <svg className="mt-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            clipRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            fillRule="evenodd"
          />
        </svg>
      )}
      <span>{message}</span>
    </div>
  );
}

/**
 * Error Summary Component
 */
function ErrorSummary({ errors }: { errors: Record<string, any> }) {
  const errorEntries = Object.entries(errors).filter(
    ([key, value]) => value?.message
  );

  if (errorEntries.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4"
      role="alert"
    >
      <div className="mb-2 flex items-center gap-2">
        <svg
          className="h-5 w-5 text-red-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            clipRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            fillRule="evenodd"
          />
        </svg>
        <h3 className="font-medium text-red-900">
          {errorEntries.length} {errorEntries.length === 1 ? "Error" : "Errors"}{" "}
          Found
        </h3>
      </div>
      <ul className="list-inside list-disc space-y-1 text-red-700 text-sm">
        {errorEntries.map(([field, error]) => (
          <li key={field}>
            <strong className="capitalize">{field}:</strong> {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Toast Notification for Errors
 */
function ErrorToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed right-4 bottom-4 flex max-w-sm animate-slide-in items-start gap-3 rounded-lg bg-red-600 px-6 py-4 text-white shadow-lg">
      <svg
        className="h-6 w-6 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          clipRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          fillRule="evenodd"
        />
      </svg>
      <div className="flex-1">
        <h4 className="font-medium">Validation Error</h4>
        <p className="mt-1 text-sm">{message}</p>
      </div>
      <button
        aria-label="Close notification"
        className="text-white hover:text-gray-200"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Form with Custom Error Display
 */
export function CustomErrorDisplayForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      age: 18,
    },
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    console.log("Form data:", data);
    setToastMessage("Form submitted successfully!");
  };

  const onError = (errors: any) => {
    // Show toast on validation error
    const errorCount = Object.keys(errors).length;
    setToastMessage(
      `Please fix ${errorCount} error${errorCount > 1 ? "s" : ""} before submitting`
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit, onError)}>
        <h2 className="font-bold text-2xl">Registration Form</h2>

        {/* Error Summary */}
        <ErrorSummary errors={errors} />

        {/* Username */}
        <div>
          <label className="mb-1 block font-medium text-sm" htmlFor="username">
            Username *
          </label>
          <input
            id="username"
            {...register("username")}
            aria-describedby={errors.username ? "username-error" : undefined}
            aria-invalid={errors.username ? "true" : "false"}
            className={`w-full rounded-md border px-3 py-2 ${
              errors.username
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300"
            }`}
          />
          {errors.username && <FormError message={errors.username.message!} />}
        </div>

        {/* Email */}
        <div>
          <label className="mb-1 block font-medium text-sm" htmlFor="email">
            Email *
          </label>
          <input
            id="email"
            type="email"
            {...register("email")}
            aria-invalid={errors.email ? "true" : "false"}
            className={`w-full rounded-md border px-3 py-2 ${
              errors.email ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.email && <FormError message={errors.email.message!} />}
        </div>

        {/* Password */}
        <div>
          <label className="mb-1 block font-medium text-sm" htmlFor="password">
            Password *
          </label>
          <input
            id="password"
            type="password"
            {...register("password")}
            aria-invalid={errors.password ? "true" : "false"}
            className={`w-full rounded-md border px-3 py-2 ${
              errors.password ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.password && <FormError message={errors.password.message!} />}
        </div>

        {/* Age */}
        <div>
          <label className="mb-1 block font-medium text-sm" htmlFor="age">
            Age *
          </label>
          <input
            id="age"
            type="number"
            {...register("age", { valueAsNumber: true })}
            aria-invalid={errors.age ? "true" : "false"}
            className={`w-full rounded-md border px-3 py-2 ${
              errors.age ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.age && <FormError message={errors.age.message!} />}
        </div>

        <button
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </form>

      {/* Toast Notification */}
      {toastMessage && (
        <ErrorToast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

/**
 * Alternative: Grouped Error Display
 */
export function GroupedErrorDisplayForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  return (
    <form
      className="mx-auto max-w-2xl space-y-6"
      onSubmit={handleSubmit((data) => console.log(data))}
    >
      <h2 className="font-bold text-2xl">Grouped Error Display</h2>

      {/* All errors in single container */}
      {Object.keys(errors).length > 0 && (
        <div className="border-red-600 border-l-4 bg-red-50 p-4">
          <h3 className="mb-2 font-medium text-red-900">
            Please correct the following:
          </h3>
          <div className="space-y-2">
            {Object.entries(errors).map(([field, error]) => (
              <div
                className="flex items-start gap-2 text-red-700 text-sm"
                key={field}
              >
                <span className="font-medium capitalize">{field}:</span>
                <span>{error.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form fields without individual error messages */}
      <input
        {...register("username")}
        className="w-full rounded border px-3 py-2"
        placeholder="Username"
      />
      <input
        {...register("email")}
        className="w-full rounded border px-3 py-2"
        placeholder="Email"
      />
      <input
        {...register("password")}
        className="w-full rounded border px-3 py-2"
        placeholder="Password"
        type="password"
      />
      <input
        {...register("age", { valueAsNumber: true })}
        className="w-full rounded border px-3 py-2"
        placeholder="Age"
        type="number"
      />

      <button
        className="w-full rounded bg-blue-600 px-4 py-2 text-white"
        type="submit"
      >
        Submit
      </button>
    </form>
  );
}
