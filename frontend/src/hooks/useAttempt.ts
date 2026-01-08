import { useQuery } from "@tanstack/react-query";
import type { Workspace } from "shared/types";
import { attemptsApi } from "@/lib/api";

export const attemptKeys = {
  byId: (attemptId: string | undefined) => ["attempt", attemptId] as const,
};

type Options = {
  enabled?: boolean;
};

export function useAttempt(attemptId?: string, opts?: Options) {
  const enabled = (opts?.enabled ?? true) && !!attemptId;

  return useQuery<Workspace>({
    queryKey: attemptKeys.byId(attemptId),
    queryFn: () => attemptsApi.get(attemptId!),
    enabled,
  });
}
