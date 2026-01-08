// AutoAnimate - SSR-Safe Pattern for Cloudflare Workers
// Prevents "useEffect not defined" errors in server environments

import type { AutoAnimateOptions } from "@formkit/auto-animate";
import { useEffect, useState } from "react";

/**
 * SSR-Safe AutoAnimate Hook
 *
 * Problem: AutoAnimate uses DOM APIs that don't exist on the server
 * Solution: Only import and use AutoAnimate on the client side
 *
 * This pattern works for:
 * - Cloudflare Workers + Static Assets
 * - Next.js (App Router & Pages Router)
 * - Remix
 * - Any SSR/SSG environment
 */

export function useAutoAnimateSafe<T extends HTMLElement>(
  options?: Partial<AutoAnimateOptions>
) {
  const [parent, setParent] = useState<T | null>(null);

  useEffect(() => {
    // Only import on client side
    if (typeof window !== "undefined" && parent) {
      import("@formkit/auto-animate").then(({ default: autoAnimate }) => {
        autoAnimate(parent, options);
      });
    }
  }, [parent, options]);

  return [parent, setParent] as const;
}

/**
 * Alternative: useAutoAnimate from react package (client-only import)
 */
export function ClientOnlyAutoAnimate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Server render: return children without animation
    return <>{children}</>;
  }

  // Client render: use AutoAnimate
  return <AnimatedList>{children}</AnimatedList>;
}

function AnimatedList({ children }: { children: React.ReactNode }) {
  // This import only runs on client
  const { useAutoAnimate } = require("@formkit/auto-animate/react");
  const [parent] = useAutoAnimate();

  return <div ref={parent}>{children}</div>;
}

/**
 * Example Usage: Todo List with SSR-Safe Hook
 */
interface Todo {
  id: number;
  text: string;
}

export function SSRSafeTodoList() {
  // Use the SSR-safe hook
  const [parent, setParent] = useAutoAnimateSafe<HTMLUListElement>();

  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: "Server-rendered todo" },
  ]);

  const [newTodo, setNewTodo] = useState("");

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos([...todos, { id: Date.now(), text: newTodo }]);
    setNewTodo("");
  };

  const removeTodo = (id: number) => {
    setTodos(todos.filter((t) => t.id !== id));
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          placeholder="New todo..."
          type="text"
          value={newTodo}
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={addTodo}
        >
          Add
        </button>
      </div>

      {/* Set ref using callback pattern for SSR safety */}
      <ul className="space-y-2" ref={setParent}>
        {todos.map((todo) => (
          <li
            className="flex items-center justify-between rounded border bg-white p-4"
            key={todo.id}
          >
            <span>{todo.text}</span>
            <button
              className="rounded bg-red-500 px-3 py-1 text-sm text-white"
              onClick={() => removeTodo(todo.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Cloudflare Workers Configuration
 *
 * In vite.config.ts:
 * import { defineConfig } from "vite";
 * import react from "@vitejs/plugin-react";
 * import cloudflare from "@cloudflare/vite-plugin";
 *
 * export default defineConfig({
 *   plugins: [react(), cloudflare()],
 *   build: {
 *     outDir: "dist",
 *   },
 *   ssr: {
 *     // Exclude AutoAnimate from SSR bundle
 *     noExternal: [],
 *     external: ["@formkit/auto-animate"],
 *   },
 * });
 *
 * This ensures AutoAnimate only runs in the browser (Static Assets),
 * not in the Worker runtime.
 */

/**
 * Common SSR Errors Prevented:
 *
 * ❌ "ReferenceError: window is not defined"
 * ❌ "Cannot find module '@formkit/auto-animate/react'"
 * ❌ "useEffect is not defined"
 * ❌ "document is not defined"
 *
 * ✅ All prevented by client-only import + conditional rendering
 */
