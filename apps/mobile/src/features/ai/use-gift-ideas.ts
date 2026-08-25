import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ai } from '../../lib/api';
import type { GiftIdeasRequest, MessageRequest } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/** Màn 21 "Suggest gifts" → màn 22. Mutation vì mỗi lần bấm là một lượt AI có chủ đích. */
export function useGiftIdeas(familyId: string | null, memberId: string | null) {
  return useMutation({
    mutationFn: (body: GiftIdeasRequest) =>
      ai.giftIdeas(familyId as string, memberId as string, body),
  });
}

/** Màn 21 — "12 photos and 4 notes about her · shared since January" (0 token, trước khi hỏi). */
export function useEvidenceStats(familyId: string | null, memberId: string | null) {
  return useQuery({
    queryKey: queryKeys.evidenceStats(familyId ?? 'none', memberId ?? 'none'),
    queryFn: () => ai.evidenceStats(familyId as string, memberId as string),
    enabled: familyId !== null && memberId !== null,
  });
}

/** Màn 21 — "Two ideas you saved last year", hiện dưới form Ask. */
export function useSavedGiftIdeas(familyId: string | null, memberId: string | null) {
  return useQuery({
    queryKey: queryKeys.savedGiftIdeas(familyId ?? 'none', memberId ?? 'none'),
    queryFn: () => ai.savedGiftIdeas(familyId as string, memberId as string),
    enabled: familyId !== null && memberId !== null,
  });
}

/** Màn 22 — nút Save trên từng card ý tưởng. */
export function useSaveGiftIdea(familyId: string | null, memberId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      title: string;
      why?: string;
      priceRange?: string;
      occasionLabel?: string;
    }) => ai.saveGiftIdea(familyId as string, memberId as string, body),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.savedGiftIdeas(familyId ?? 'none', memberId ?? 'none'),
      }),
  });
}

/** Màn 24-25 — 3 biến thể; "Say it differently" gọi lại với tone khác (miễn phí về UX). */
export function useMessageSuggestions(familyId: string | null, memberId: string | null) {
  return useMutation({
    mutationFn: (body: MessageRequest) =>
      ai.messageSuggestions(familyId as string, memberId as string, body),
  });
}
