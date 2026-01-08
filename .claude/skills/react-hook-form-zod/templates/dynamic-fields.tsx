/**
 * Dynamic Form Fields Example - useFieldArray
 *
 * Demonstrates:
 * - useFieldArray for dynamic add/remove functionality
 * - Array validation with Zod
 * - Proper key usage (field.id, not index)
 * - Nested field error handling
 * - Add, remove, update, insert operations
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

// Schema for contact list
const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number")
    .optional(),
  isPrimary: z.boolean().optional(),
});

const contactListSchema = z.object({
  contacts: z
    .array(contactSchema)
    .min(1, "At least one contact is required")
    .max(10, "Maximum 10 contacts allowed"),
});

type ContactListData = z.infer<typeof contactListSchema>;

export function DynamicContactList() {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactListData>({
    resolver: zodResolver(contactListSchema),
    defaultValues: {
      contacts: [{ name: "", email: "", phone: "", isPrimary: false }],
    },
  });

  const { fields, append, remove, insert, update } = useFieldArray({
    control,
    name: "contacts",
  });

  const onSubmit = (data: ContactListData) => {
    console.log("Contacts:", data);
  };

  return (
    <form
      className="mx-auto max-w-2xl space-y-6"
      onSubmit={handleSubmit(onSubmit)}
    >
      <h2 className="font-bold text-2xl">Contact List</h2>

      {/* Array error (min/max length) */}
      {errors.contacts && !Array.isArray(errors.contacts) && (
        <div
          className="rounded bg-red-50 p-3 text-red-600 text-sm"
          role="alert"
        >
          {errors.contacts.message}
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            className="space-y-3 rounded-lg border p-4" // IMPORTANT: Use field.id, not index
            key={field.id}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Contact {index + 1}</h3>
              <button
                className="text-red-600 text-sm hover:text-red-800"
                disabled={fields.length === 1}
                onClick={() => remove(index)}
                type="button" // Require at least one contact
              >
                Remove
              </button>
            </div>

            {/* Name */}
            <div>
              <label
                className="mb-1 block font-medium text-sm"
                htmlFor={`contacts.${index}.name`}
              >
                Name *
              </label>
              <input
                id={`contacts.${index}.name`}
                {...register(`contacts.${index}.name` as const)}
                className="w-full rounded-md border px-3 py-2"
              />
              {errors.contacts?.[index]?.name && (
                <span className="mt-1 block text-red-600 text-sm" role="alert">
                  {errors.contacts[index]?.name?.message}
                </span>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                className="mb-1 block font-medium text-sm"
                htmlFor={`contacts.${index}.email`}
              >
                Email *
              </label>
              <input
                id={`contacts.${index}.email`}
                type="email"
                {...register(`contacts.${index}.email` as const)}
                className="w-full rounded-md border px-3 py-2"
              />
              {errors.contacts?.[index]?.email && (
                <span className="mt-1 block text-red-600 text-sm" role="alert">
                  {errors.contacts[index]?.email?.message}
                </span>
              )}
            </div>

            {/* Phone */}
            <div>
              <label
                className="mb-1 block font-medium text-sm"
                htmlFor={`contacts.${index}.phone`}
              >
                Phone (Optional)
              </label>
              <input
                id={`contacts.${index}.phone`}
                type="tel"
                {...register(`contacts.${index}.phone` as const)}
                className="w-full rounded-md border px-3 py-2"
                placeholder="+1234567890"
              />
              {errors.contacts?.[index]?.phone && (
                <span className="mt-1 block text-red-600 text-sm" role="alert">
                  {errors.contacts[index]?.phone?.message}
                </span>
              )}
            </div>

            {/* Primary Contact Checkbox */}
            <div className="flex items-center">
              <input
                id={`contacts.${index}.isPrimary`}
                type="checkbox"
                {...register(`contacts.${index}.isPrimary` as const)}
                className="h-4 w-4 rounded"
              />
              <label
                className="ml-2 text-sm"
                htmlFor={`contacts.${index}.isPrimary`}
              >
                Primary contact
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Add Contact Button */}
      <div className="flex gap-2">
        <button
          className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
          disabled={fields.length >= 10}
          onClick={() =>
            append({ name: "", email: "", phone: "", isPrimary: false })
          }
          type="button"
        >
          Add Contact
        </button>

        <button
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          onClick={() =>
            insert(0, { name: "", email: "", phone: "", isPrimary: false })
          }
          type="button"
        >
          Add at Top
        </button>
      </div>

      {/* Submit */}
      <button
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        type="submit"
      >
        Save Contacts
      </button>
    </form>
  );
}

/**
 * Advanced Example: Skills with Custom Add
 */
const skillSchema = z.object({
  name: z.string().min(1, "Skill name is required"),
  level: z.enum(["beginner", "intermediate", "advanced", "expert"]),
  yearsOfExperience: z.number().int().min(0).max(50),
});

const skillsFormSchema = z.object({
  skills: z.array(skillSchema).min(1, "Add at least one skill"),
});

type SkillsFormData = z.infer<typeof skillsFormSchema>;

export function DynamicSkillsForm() {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SkillsFormData>({
    resolver: zodResolver(skillsFormSchema),
    defaultValues: {
      skills: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "skills",
  });

  // Preset skill templates
  const addPresetSkill = (skillName: string) => {
    append({
      name: skillName,
      level: "intermediate",
      yearsOfExperience: 1,
    });
  };

  const onSubmit = (data: SkillsFormData) => {
    console.log("Skills:", data);
  };

  return (
    <form
      className="mx-auto max-w-2xl space-y-6"
      onSubmit={handleSubmit(onSubmit)}
    >
      <h2 className="font-bold text-2xl">Your Skills</h2>

      {errors.skills && !Array.isArray(errors.skills) && (
        <div className="text-red-600 text-sm" role="alert">
          {errors.skills.message}
        </div>
      )}

      {/* Preset Skills */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm">Quick Add:</h3>
        <div className="flex flex-wrap gap-2">
          {["React", "TypeScript", "Node.js", "Python", "SQL"].map((skill) => (
            <button
              className="rounded-full bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
              key={skill}
              onClick={() => addPresetSkill(skill)}
              type="button"
            >
              + {skill}
            </button>
          ))}
        </div>
      </div>

      {/* Skills List */}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div
            className="flex items-start gap-3 rounded border p-3"
            key={field.id}
          >
            <div className="flex-1 space-y-2">
              <input
                {...register(`skills.${index}.name` as const)}
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="Skill name"
              />
              {errors.skills?.[index]?.name && (
                <span className="text-red-600 text-xs">
                  {errors.skills[index]?.name?.message}
                </span>
              )}

              <div className="grid grid-cols-2 gap-2">
                <select
                  {...register(`skills.${index}.level` as const)}
                  className="rounded border px-2 py-1 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>

                <input
                  type="number"
                  {...register(`skills.${index}.yearsOfExperience` as const, {
                    valueAsNumber: true,
                  })}
                  className="rounded border px-2 py-1 text-sm"
                  placeholder="Years"
                />
              </div>
            </div>

            <button
              className="px-2 text-red-600 text-sm hover:text-red-800"
              onClick={() => remove(index)}
              type="button"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Custom Add */}
      <button
        className="w-full rounded-md border-2 border-gray-300 border-dashed px-4 py-2 text-gray-600 hover:border-gray-400"
        onClick={() =>
          append({ name: "", level: "beginner", yearsOfExperience: 0 })
        }
        type="button"
      >
        + Add Custom Skill
      </button>

      <button
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        type="submit"
      >
        Save Skills
      </button>
    </form>
  );
}
