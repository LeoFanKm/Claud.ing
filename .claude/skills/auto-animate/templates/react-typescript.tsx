// AutoAnimate - TypeScript Setup with Configuration
// @formkit/auto-animate v0.9.0

import type { AutoAnimateOptions } from "@formkit/auto-animate";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useState } from "react";

/**
 * Example: TypeScript Setup with Custom Configuration
 *
 * This shows:
 * - Proper TypeScript types
 * - Custom animation duration/easing
 * - Access to animation controller
 * - Type-safe configuration
 */

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

export function TypeScriptExample() {
  // Custom configuration with types
  const animationConfig: Partial<AutoAnimateOptions> = {
    duration: 250, // milliseconds
    easing: "ease-in-out",
    // disrespectUserMotionPreference: false, // Keep false for accessibility
  };

  // Get ref and controller with proper types
  const [parent, controller] =
    useAutoAnimate<HTMLUListElement>(animationConfig);

  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", title: "Learn AutoAnimate", completed: false },
    { id: "2", title: "Build awesome UI", completed: false },
  ]);

  const [newTaskTitle, setNewTaskTitle] = useState("");

  const addTask = () => {
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      completed: false,
    };

    setTasks([...tasks, newTask]);
    setNewTaskTitle("");
  };

  const toggleTask = (id: string) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((task) => task.id !== id));
  };

  // Optional: Manually enable/disable animations
  const toggleAnimations = () => {
    if (controller) {
      controller.isEnabled() ? controller.disable() : controller.enable();
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h2 className="font-bold text-2xl">Tasks</h2>

      {/* Add task form */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="New task..."
          type="text"
          value={newTaskTitle}
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          onClick={addTask}
        >
          Add
        </button>
      </div>

      {/* Task list with ref */}
      <ul className="space-y-2" ref={parent}>
        {tasks.map((task) => (
          <li
            className={`flex items-center gap-3 rounded border p-4 ${
              task.completed ? "bg-gray-50" : "bg-white"
            }`}
            key={task.id}
          >
            <input
              checked={task.completed}
              className="h-5 w-5"
              onChange={() => toggleTask(task.id)}
              type="checkbox"
            />
            <span
              className={`flex-1 ${
                task.completed ? "text-gray-500 line-through" : ""
              }`}
            >
              {task.title}
            </span>
            <button
              className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
              onClick={() => deleteTask(task.id)}
            >
              Delete
            </button>
          </li>
        ))}

        {tasks.length === 0 && (
          <li className="p-4 text-center text-gray-500">
            No tasks yet. Add one above!
          </li>
        )}
      </ul>

      {/* Optional: Animation toggle */}
      <button
        className="text-gray-600 text-sm underline"
        onClick={toggleAnimations}
      >
        Toggle Animations
      </button>
    </div>
  );
}

/**
 * TypeScript Tips:
 *
 * 1. Import types from @formkit/auto-animate
 * import type { AutoAnimateOptions, AnimationController } from "@formkit/auto-animate";
 *
 * 2. Type the ref explicitly
 * const [parent, controller] = useAutoAnimate<HTMLUListElement>();
 *
 * 3. Use Partial<AutoAnimateOptions> for config
 * const config: Partial<AutoAnimateOptions> = { duration: 250 };
 *
 * 4. Controller methods (optional)
 * controller.enable() - Enable animations
 * controller.disable() - Disable animations
 * controller.isEnabled() - Check if enabled
 */

/**
 * Configuration Options:
 *
 * duration: number (default: 250ms)
 * easing: string (default: "ease-in-out")
 * disrespectUserMotionPreference: boolean (default: false) - Keep false!
 *
 * Note: AutoAnimate automatically respects prefers-reduced-motion
 * unless disrespectUserMotionPreference is true (NOT recommended)
 */
