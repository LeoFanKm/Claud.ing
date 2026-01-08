import { useQuery } from "@tanstack/react-query";
import type { GitBranch } from "shared/types";
import { repoApi } from "@/lib/api";

export const repoBranchKeys = {
  all: ["repoBranches"] as const,
  byRepo: (repoId: string | undefined) => ["repoBranches", repoId] as const,
};

type Options = {
  enabled?: boolean;
};

export function useRepoBranches(repoId?: string | null, opts?: Options) {
  const enabled = (opts?.enabled ?? true) && !!repoId;

  return useQuery<GitBranch[]>({
    queryKey: repoBranchKeys.byRepo(repoId ?? undefined),
    queryFn: () => repoApi.getBranches(repoId!),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
