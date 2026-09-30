import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import { apiPost } from "@/lib/api";

interface EngagementPayload {
  event_name: string;
  idea_id?: string;
  ticker?: string;
  stage?: string;
  properties?: Record<string, unknown>;
}

export function useEngagement() {
  const mutation = useMutation({
    mutationFn: (payload: EngagementPayload) => apiPost<{ recorded: boolean }>("/events", payload),
  });
  const track = useCallback((payload: EngagementPayload) => mutation.mutate(payload), [mutation]);
  return { track };
}