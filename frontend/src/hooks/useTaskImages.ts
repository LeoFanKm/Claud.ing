import { useQuery } from "@tanstack/react-query";
import type { ImageResponse } from "shared/types";
import { imagesApi } from "@/lib/api";

export function useTaskImages(taskId?: string) {
  return useQuery<ImageResponse[]>({
    queryKey: ["taskImages", taskId],
    queryFn: () => imagesApi.getTaskImages(taskId!),
    enabled: !!taskId,
  });
}
