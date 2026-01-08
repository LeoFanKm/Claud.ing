/**
 * Advanced Form Example - User Profile with Nested Objects and Arrays
 *
 * Demonstrates:
 * - Nested object validation (address)
 * - Array field validation (skills)
 * - Conditional field validation
 * - Complex Zod schemas with refinements
 * - Type-safe nested error handling
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Define nested schemas
const addressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State must be at least 2 characters"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  country: z.string().min(1, "Country is required"),
});

// Complex schema with nested objects and arrays
const profileSchema = z
  .object({
    // Basic fields
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number")
      .optional(),

    // Nested object
    address: addressSchema,

    // Array of strings
    skills: z
      .array(z.string().min(1, "Skill cannot be empty"))
      .min(1, "At least one skill is required")
      .max(10, "Maximum 10 skills allowed"),

    // Conditional fields
    isStudent: z.boolean(),
    school: z.string().optional(),
    graduationYear: z.number().int().min(1900).max(2100).optional(),

    // Enum
    experience: z.enum(["junior", "mid", "senior", "lead"], {
      errorMap: () => ({ message: "Please select experience level" }),
    }),

    // Number with constraints
    yearsOfExperience: z
      .number()
      .int("Must be a whole number")
      .min(0, "Cannot be negative")
      .max(50, "Must be 50 or less"),

    // Date
    availableFrom: z.date().optional(),

    // Boolean
    agreedToTerms: z.boolean().refine((val) => val === true, {
      message: "You must agree to the terms and conditions",
    }),
  })
  .refine(
    (data) => {
      // Conditional validation: if isStudent is true, school is required
      if (data.isStudent && !data.school) {
        return false;
      }
      return true;
    },
    {
      message: "School is required for students",
      path: ["school"],
    }
  )
  .refine(
    (data) => {
      // Experience level should match years of experience
      if (data.experience === "senior" && data.yearsOfExperience < 5) {
        return false;
      }
      return true;
    },
    {
      message: "Senior level requires at least 5 years of experience",
      path: ["yearsOfExperience"],
    }
  );

type ProfileFormData = z.infer<typeof profileSchema>;

export function AdvancedProfileForm() {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "USA",
      },
      skills: [""], // Start with one empty skill
      isStudent: false,
      school: "",
      experience: "junior",
      yearsOfExperience: 0,
      agreedToTerms: false,
    },
  });

  // Watch isStudent to conditionally show school field
  const isStudent = watch("isStudent");

  const onSubmit = async (data: ProfileFormData) => {
    console.log("Profile data:", data);
    // API call
  };

  return (
    <form
      className="mx-auto max-w-2xl space-y-6"
      onSubmit={handleSubmit(onSubmit)}
    >
      <h2 className="font-bold text-3xl">User Profile</h2>

      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="font-semibold text-xl">Basic Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              className="mb-1 block font-medium text-sm"
              htmlFor="firstName"
            >
              First Name *
            </label>
            <input
              id="firstName"
              {...register("firstName")}
              className="w-full rounded-md border px-3 py-2"
            />
            {errors.firstName && (
              <span className="mt-1 block text-red-600 text-sm" role="alert">
                {errors.firstName.message}
              </span>
            )}
          </div>

          <div>
            <label
              className="mb-1 block font-medium text-sm"
              htmlFor="lastName"
            >
              Last Name *
            </label>
            <input
              id="lastName"
              {...register("lastName")}
              className="w-full rounded-md border px-3 py-2"
            />
            {errors.lastName && (
              <span className="mt-1 block text-red-600 text-sm" role="alert">
                {errors.lastName.message}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block font-medium text-sm" htmlFor="email">
            Email *
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
          <label className="mb-1 block font-medium text-sm" htmlFor="phone">
            Phone (Optional)
          </label>
          <input
            id="phone"
            type="tel"
            {...register("phone")}
            className="w-full rounded-md border px-3 py-2"
            placeholder="+1234567890"
          />
          {errors.phone && (
            <span className="mt-1 block text-red-600 text-sm" role="alert">
              {errors.phone.message}
            </span>
          )}
        </div>
      </section>

      {/* Address (Nested Object) */}
      <section className="space-y-4">
        <h3 className="font-semibold text-xl">Address</h3>

        <div>
          <label className="mb-1 block font-medium text-sm" htmlFor="street">
            Street *
          </label>
          <input
            id="street"
            {...register("address.street")}
            className="w-full rounded-md border px-3 py-2"
          />
          {errors.address?.street && (
            <span className="mt-1 block text-red-600 text-sm" role="alert">
              {errors.address.street.message}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block font-medium text-sm" htmlFor="city">
              City *
            </label>
            <input
              id="city"
              {...register("address.city")}
              className="w-full rounded-md border px-3 py-2"
            />
            {errors.address?.city && (
              <span className="mt-1 block text-red-600 text-sm" role="alert">
                {errors.address.city.message}
              </span>
            )}
          </div>

          <div>
            <label className="mb-1 block font-medium text-sm" htmlFor="state">
              State *
            </label>
            <input
              id="state"
              {...register("address.state")}
              className="w-full rounded-md border px-3 py-2"
            />
            {errors.address?.state && (
              <span className="mt-1 block text-red-600 text-sm" role="alert">
                {errors.address.state.message}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block font-medium text-sm" htmlFor="zipCode">
              ZIP Code *
            </label>
            <input
              id="zipCode"
              {...register("address.zipCode")}
              className="w-full rounded-md border px-3 py-2"
              placeholder="12345 or 12345-6789"
            />
            {errors.address?.zipCode && (
              <span className="mt-1 block text-red-600 text-sm" role="alert">
                {errors.address.zipCode.message}
              </span>
            )}
          </div>

          <div>
            <label className="mb-1 block font-medium text-sm" htmlFor="country">
              Country *
            </label>
            <input
              id="country"
              {...register("address.country")}
              className="w-full rounded-md border px-3 py-2"
            />
            {errors.address?.country && (
              <span className="mt-1 block text-red-600 text-sm" role="alert">
                {errors.address.country.message}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Skills (Array - simplified for advanced-form, see dynamic-fields.tsx for full array handling) */}
      <section className="space-y-4">
        <h3 className="font-semibold text-xl">Skills</h3>
        <p className="text-gray-600 text-sm">
          Enter skills separated by commas (handled as string for simplicity in
          this example)
        </p>
        <div>
          <label className="mb-1 block font-medium text-sm" htmlFor="skills">
            Skills (comma-separated) *
          </label>
          <input
            id="skills"
            {...register("skills.0")} // Simplified - see dynamic-fields.tsx for proper array handling
            className="w-full rounded-md border px-3 py-2"
            placeholder="React, TypeScript, Node.js"
          />
          {errors.skills && (
            <span className="mt-1 block text-red-600 text-sm" role="alert">
              {errors.skills.message || errors.skills[0]?.message}
            </span>
          )}
        </div>
      </section>

      {/* Experience */}
      <section className="space-y-4">
        <h3 className="font-semibold text-xl">Experience</h3>

        <div>
          <label
            className="mb-1 block font-medium text-sm"
            htmlFor="experience"
          >
            Experience Level *
          </label>
          <select
            id="experience"
            {...register("experience")}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="junior">Junior</option>
            <option value="mid">Mid-Level</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
          </select>
          {errors.experience && (
            <span className="mt-1 block text-red-600 text-sm" role="alert">
              {errors.experience.message}
            </span>
          )}
        </div>

        <div>
          <label
            className="mb-1 block font-medium text-sm"
            htmlFor="yearsOfExperience"
          >
            Years of Experience *
          </label>
          <input
            id="yearsOfExperience"
            type="number"
            {...register("yearsOfExperience", { valueAsNumber: true })}
            className="w-full rounded-md border px-3 py-2"
          />
          {errors.yearsOfExperience && (
            <span className="mt-1 block text-red-600 text-sm" role="alert">
              {errors.yearsOfExperience.message}
            </span>
          )}
        </div>
      </section>

      {/* Conditional Fields */}
      <section className="space-y-4">
        <h3 className="font-semibold text-xl">Education</h3>

        <div className="flex items-center">
          <input
            id="isStudent"
            type="checkbox"
            {...register("isStudent")}
            className="h-4 w-4 rounded"
          />
          <label className="ml-2 text-sm" htmlFor="isStudent">
            I am currently a student
          </label>
        </div>

        {/* Conditional field - only show if isStudent is true */}
        {isStudent && (
          <div>
            <label className="mb-1 block font-medium text-sm" htmlFor="school">
              School Name *
            </label>
            <input
              id="school"
              {...register("school")}
              className="w-full rounded-md border px-3 py-2"
            />
            {errors.school && (
              <span className="mt-1 block text-red-600 text-sm" role="alert">
                {errors.school.message}
              </span>
            )}
          </div>
        )}
      </section>

      {/* Terms and Conditions */}
      <section className="space-y-4">
        <div className="flex items-start">
          <input
            id="agreedToTerms"
            type="checkbox"
            {...register("agreedToTerms")}
            className="mt-1 h-4 w-4 rounded"
          />
          <label className="ml-2 text-sm" htmlFor="agreedToTerms">
            I agree to the terms and conditions *
          </label>
        </div>
        {errors.agreedToTerms && (
          <span className="block text-red-600 text-sm" role="alert">
            {errors.agreedToTerms.message}
          </span>
        )}
      </section>

      {/* Submit Button */}
      <button
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
