import { useQuery } from "@tanstack/react-query";
import type { Task } from "shared/types";
import { tasksApi } from "@/lib/api";

export const taskKeys = {
  all: ["tasks"] as const,
  byId: (taskId: string | undefined) => ["tasks", taskId] as const,
};

type Options = {
  enabled?: boolean;
};

export function useTask(taskId?: string, opts?: Options) {
  const enabled = (opts?.enabled ?? true) && !!taskId;

  return useQuery<Task>({
    queryKey: taskKeys.byId(taskId),
    queryFn: () => tasksApi.getById(taskId!),
    enabled,
  });
}
