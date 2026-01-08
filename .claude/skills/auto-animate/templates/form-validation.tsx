// AutoAnimate - Form Validation Messages
// Error messages that smoothly appear/disappear

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useState } from "react";

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
}

interface Errors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function FormValidationExample() {
  const [emailParent] = useAutoAnimate();
  const [passwordParent] = useAutoAnimate();
  const [confirmParent] = useAutoAnimate();

  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validate = () => {
    const newErrors: Errors = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field: keyof FormData) => {
    setTouched({ ...touched, [field]: true });
    validate();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true, confirmPassword: true });
    if (validate()) {
      alert("Form submitted successfully!");
    }
  };

  return (
    <form className="mx-auto max-w-md space-y-4 p-6" onSubmit={handleSubmit}>
      {/* Email */}
      <div>
        <label className="mb-1 block font-medium text-sm">Email</label>
        <input
          className={`w-full rounded border px-3 py-2 ${
            touched.email && errors.email ? "border-red-500" : ""
          }`}
          onBlur={() => handleBlur("email")}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          type="email"
          value={formData.email}
        />
        <div ref={emailParent}>
          {touched.email && errors.email && (
            <p className="mt-1 text-red-500 text-sm">{errors.email}</p>
          )}
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="mb-1 block font-medium text-sm">Password</label>
        <input
          className={`w-full rounded border px-3 py-2 ${
            touched.password && errors.password ? "border-red-500" : ""
          }`}
          onBlur={() => handleBlur("password")}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          type="password"
          value={formData.password}
        />
        <div ref={passwordParent}>
          {touched.password && errors.password && (
            <p className="mt-1 text-red-500 text-sm">{errors.password}</p>
          )}
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label className="mb-1 block font-medium text-sm">
          Confirm Password
        </label>
        <input
          className={`w-full rounded border px-3 py-2 ${
            touched.confirmPassword && errors.confirmPassword
              ? "border-red-500"
              : ""
          }`}
          onBlur={() => handleBlur("confirmPassword")}
          onChange={(e) =>
            setFormData({ ...formData, confirmPassword: e.target.value })
          }
          type="password"
          value={formData.confirmPassword}
        />
        <div ref={confirmParent}>
          {touched.confirmPassword && errors.confirmPassword && (
            <p className="mt-1 text-red-500 text-sm">
              {errors.confirmPassword}
            </p>
          )}
        </div>
      </div>

      <button
        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        type="submit"
      >
        Submit
      </button>
    </form>
  );
}

/**
 * Pattern: Each error message has its own parent ref
 * This allows independent animations for each field
 */
