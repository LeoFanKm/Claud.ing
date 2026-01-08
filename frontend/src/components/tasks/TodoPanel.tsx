import { Check, ChevronUp, Circle, CircleDot } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEntries } from "@/contexts/EntriesContext";
import { usePinnedTodos } from "@/hooks/usePinnedTodos";
import { Card } from "../ui/card";

const TODO_PANEL_OPEN_KEY = "todo-panel-open";

function getStatusIcon(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "completed")
    return <Check aria-hidden className="h-4 w-4 text-success" />;
  if (s === "in_progress" || s === "in-progress")
    return <CircleDot aria-hidden className="h-4 w-4 text-blue-500" />;
  if (s === "cancelled")
    return <Circle aria-hidden className="h-4 w-4 text-gray-400" />;
  return <Circle aria-hidden className="h-4 w-4 text-muted-foreground" />;
}

function TodoPanel() {
  const { t } = useTranslation("tasks");
  const { entries } = useEntries();
  const { todos } = usePinnedTodos(entries);
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(TODO_PANEL_OPEN_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(TODO_PANEL_OPEN_KEY, String(isOpen));
  }, [isOpen]);

  if (!todos || todos.length === 0) return null;

  return (
    <details
      className="group"
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
      open={isOpen}
    >
      <summary className="cursor-pointer list-none">
        <Card className="flex items-center justify-between bg-muted p-3 text-sm">
          <span>{t("todos.title", { count: todos.length })}</span>
          <ChevronUp
            aria-hidden
            className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </Card>
      </summary>
      <div className="px-3 pb-2">
        <ul className="space-y-2">
          {todos.map((todo, index) => (
            <li
              className="flex items-start gap-2"
              key={`${todo.content}-${index}`}
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                {getStatusIcon(todo.status)}
              </span>
              <span className="break-words text-sm leading-5">
                {todo.status?.toLowerCase() === "cancelled" ? (
                  <s className="text-gray-400">{todo.content}</s>
                ) : (
                  todo.content
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export default TodoPanel;
