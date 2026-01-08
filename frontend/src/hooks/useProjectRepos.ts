import { useQuery } from "@tanstack/react-query";
import type { Repo } from "shared/types";
import { projectsApi } from "@/lib/api";

type Options = {
  enabled?: boolean;
};

export function useProjectRepos(projectId?: string, opts?: Options) {
  const enabled = (opts?.enabled ?? true) && !!projectId;

  return useQuery<Repo[]>({
    queryKey: ["projectRepositories", projectId],
    queryFn: () => projectsApi.getRepositories(projectId!),
    enabled,
  });
}
