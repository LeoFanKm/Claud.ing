import { useCallback } from "react";
import type { Scratch, ScratchType, UpdateScratch } from "shared/types";
import { scratchApi } from "@/lib/api";
import { useJsonPatchWsStream } from "./useJsonPatchWsStream";

type ScratchState = {
  scratch: Scratch | null;
};

export interface UseScratchResult {
  scratch: Scratch | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  updateScratch: (update: UpdateScratch) => Promise<void>;
  deleteScratch: () => Promise<void>;
}

/**
 * Stream a single scratch item via WebSocket (JSON Patch).
 * Server sends the scratch object directly at /scratch.
 */
export const useScratch = (
  scratchType: ScratchType,
  id: string
): UseScratchResult => {
  const endpoint = scratchApi.getStreamUrl(scratchType, id);

  const initialData = useCallback((): ScratchState => ({ scratch: null }), []);

  const { data, isConnected, error } = useJsonPatchWsStream<ScratchState>(
    endpoint,
    true,
    initialData
  );

  // Treat deleted scratches as null
  const rawScratch = data?.scratch as (Scratch & { deleted?: boolean }) | null;
  const scratch = rawScratch?.deleted ? null : rawScratch;

  const updateScratch = useCallback(
    async (update: UpdateScratch) => {
      await scratchApi.update(scratchType, id, update);
    },
    [scratchType, id]
  );

  const deleteScratch = useCallback(async () => {
    await scratchApi.delete(scratchType, id);
  }, [scratchType, id]);

  const isLoading = !(data || error || isConnected);

  return {
    scratch,
    isLoading,
    isConnected,
    error,
    updateScratch,
    deleteScratch,
  };
};
