import { useQuery } from "@tanstack/react-query";
import type { RemoteProjectMembersResponse } from "shared/types";
import { projectsApi } from "@/lib/api";

export function useProjectRemoteMembers(projectId?: string) {
  return useQuery<RemoteProjectMembersResponse, Error>({
    queryKey: ["project", "remote-members", projectId],
    queryFn: () => projectsApi.getRemoteMembers(projectId!),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });
}
