/**
 * Multi-Step Form Example (Wizard)
 *
 * Demonstrates:
 * - Multi-step form with per-step validation
 * - Progress tracking
 * - Step navigation (next, previous)
 * - Partial schema validation
 * - Combined schema for final submission
 * - Preserving form state across steps
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Step 1: Personal Information
const step1Schema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
});

// Step 2: Address
const step2Schema = z.object({
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State must be at least 2 characters"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
});

// Step 3: Account
const step3Schema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain uppercase letter")
      .regex(/[0-9]/, "Password must contain number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Combined schema for final validation
const fullFormSchema = step1Schema.merge(step2Schema).merge(step3Schema);

type FormData = z.infer<typeof fullFormSchema>;
type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

const TOTAL_STEPS = 3;

export function MultiStepRegistrationForm() {
  const [currentStep, setCurrentStep] = useState(1);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(fullFormSchema),
    mode: "onChange", // Validate as user types
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Navigate to next step
  const nextStep = async () => {
    let fieldsToValidate: (keyof FormData)[] = [];

    if (currentStep === 1) {
      fieldsToValidate = ["firstName", "lastName", "email", "phone"];
    } else if (currentStep === 2) {
      fieldsToValidate = ["street", "city", "state", "zipCode"];
    }

    // Trigger validation for current step fields
    const isValid = await trigger(fieldsToValidate);

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  // Navigate to previous step
  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Final form submission
  const onSubmit = async (data: FormData) => {
    console.log("Complete form data:", data);
    // Make API call
    alert("Form submitted successfully!");
  };

  // Calculate progress percentage
  const progressPercentage = (currentStep / TOTAL_STEPS) * 100;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between">
          <span className="font-medium text-gray-700 text-sm">
            Step {currentStep} of {TOTAL_STEPS}
          </span>
          <span className="font-medium text-gray-700 text-sm">
            {Math.round(progressPercentage)}% Complete
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Step Indicators */}
        <div className="mt-4 flex justify-between">
          {[1, 2, 3].map((step) => (
            <div
              className={`flex items-center ${
                step < TOTAL_STEPS ? "flex-1" : ""
              }`}
              key={step}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm ${
                  step < currentStep
                    ? "bg-green-600 text-white"
                    : step === currentStep
                      ? "bg-blue-600 text-white"
                      : "bg-gray-300 text-gray-600"
                }`}
              >
                {step < currentStep ? "✓" : step}
              </div>
              {step < TOTAL_STEPS && (
                <div
                  className={`mx-2 h-1 flex-1 ${
                    step < currentStep ? "bg-green-600" : "bg-gray-300"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Personal Information */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-2xl">Personal Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-medium text-sm">
                  First Name *
                </label>
                <input
                  {...register("firstName")}
                  className="w-full rounded-md border px-3 py-2"
                />
                {errors.firstName && (
                  <span className="text-red-600 text-sm">
                    {errors.firstName.message}
                  </span>
                )}
              </div>

              <div>
                <label className="mb-1 block font-medium text-sm">
                  Last Name *
                </label>
                <input
                  {...register("lastName")}
                  className="w-full rounded-md border px-3 py-2"
                />
                {errors.lastName && (
                  <span className="text-red-600 text-sm">
                    {errors.lastName.message}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-sm">Email *</label>
              <input
                type="email"
                {...register("email")}
                className="w-full rounded-md border px-3 py-2"
              />
              {errors.email && (
                <span className="text-red-600 text-sm">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div>
              <label className="mb-1 block font-medium text-sm">Phone *</label>
              <input
                type="tel"
                {...register("phone")}
                className="w-full rounded-md border px-3 py-2"
                placeholder="+1234567890"
              />
              {errors.phone && (
                <span className="text-red-600 text-sm">
                  {errors.phone.message}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="font-bold text-2xl">Address</h2>

            <div>
              <label className="mb-1 block font-medium text-sm">
                Street Address *
              </label>
              <input
                {...register("street")}
                className="w-full rounded-md border px-3 py-2"
              />
              {errors.street && (
                <span className="text-red-600 text-sm">
                  {errors.street.message}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-medium text-sm">City *</label>
                <input
                  {...register("city")}
                  className="w-full rounded-md border px-3 py-2"
                />
                {errors.city && (
                  <span className="text-red-600 text-sm">
                    {errors.city.message}
                  </span>
                )}
              </div>

              <div>
                <label className="mb-1 block font-medium text-sm">
                  State *
                </label>
                <input
                  {...register("state")}
                  className="w-full rounded-md border px-3 py-2"
                />
                {errors.state && (
                  <span className="text-red-600 text-sm">
                    {errors.state.message}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-sm">
                ZIP Code *
              </label>
              <input
                {...register("zipCode")}
                className="w-full rounded-md border px-3 py-2"
                placeholder="12345 or 12345-6789"
              />
              {errors.zipCode && (
                <span className="text-red-600 text-sm">
                  {errors.zipCode.message}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Account */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-2xl">Create Account</h2>

            <div>
              <label className="mb-1 block font-medium text-sm">
                Username *
              </label>
              <input
                {...register("username")}
                className="w-full rounded-md border px-3 py-2"
              />
              {errors.username && (
                <span className="text-red-600 text-sm">
                  {errors.username.message}
                </span>
              )}
            </div>

            <div>
              <label className="mb-1 block font-medium text-sm">
                Password *
              </label>
              <input
                type="password"
                {...register("password")}
                className="w-full rounded-md border px-3 py-2"
              />
              {errors.password && (
                <span className="text-red-600 text-sm">
                  {errors.password.message}
                </span>
              )}
            </div>

            <div>
              <label className="mb-1 block font-medium text-sm">
                Confirm Password *
              </label>
              <input
                type="password"
                {...register("confirmPassword")}
                className="w-full rounded-md border px-3 py-2"
              />
              {errors.confirmPassword && (
                <span className="text-red-600 text-sm">
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>

            {/* Summary */}
            <div className="mt-6 rounded-md bg-gray-50 p-4">
              <h3 className="mb-2 font-medium">Review Your Information:</h3>
              <div className="space-y-1 text-sm">
                <p>
                  <strong>Name:</strong> {getValues("firstName")}{" "}
                  {getValues("lastName")}
                </p>
                <p>
                  <strong>Email:</strong> {getValues("email")}
                </p>
                <p>
                  <strong>Phone:</strong> {getValues("phone")}
                </p>
                <p>
                  <strong>Address:</strong> {getValues("street")},{" "}
                  {getValues("city")}, {getValues("state")}{" "}
                  {getValues("zipCode")}
                </p>
                <p>
                  <strong>Username:</strong> {getValues("username")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <button
            className="rounded-md border px-6 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentStep === 1}
            onClick={prevStep}
            type="button"
          >
            Previous
          </button>

          {currentStep < TOTAL_STEPS ? (
            <button
              className="rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
              onClick={nextStep}
              type="button"
            >
              Next
            </button>
          ) : (
            <button
              className="rounded-md bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Submitting..." : "Complete Registration"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
