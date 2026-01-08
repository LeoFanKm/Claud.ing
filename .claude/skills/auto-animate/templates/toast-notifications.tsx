// AutoAnimate - Toast Notifications
// Fade in/out for temporary messages

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useState } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export function ToastExample() {
  const [parent] = useAutoAnimate();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast["type"]) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex gap-2">
        <button
          className="rounded bg-green-600 px-4 py-2 text-white"
          onClick={() => addToast("Success!", "success")}
        >
          Success Toast
        </button>
        <button
          className="rounded bg-red-600 px-4 py-2 text-white"
          onClick={() => addToast("Error occurred", "error")}
        >
          Error Toast
        </button>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() => addToast("Info message", "info")}
        >
          Info Toast
        </button>
      </div>

      {/* Toast container */}
      <div className="fixed top-4 right-4 w-80 space-y-2" ref={parent}>
        {toasts.map((toast) => (
          <div
            className={`rounded p-4 shadow-lg ${
              toast.type === "success"
                ? "bg-green-500"
                : toast.type === "error"
                  ? "bg-red-500"
                  : "bg-blue-500"
            } text-white`}
            key={toast.id}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
