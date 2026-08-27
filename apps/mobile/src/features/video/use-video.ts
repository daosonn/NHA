import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { video } from '../../lib/api';
import type { CreateVideoJobRequest, StoryboardRequest, VideoJob } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/** Màn 29 — thư viện nhạc theo mood (thay đổi rất hiếm → staleTime dài). */
export function useVideoMusic() {
  return useQuery({
    queryKey: queryKeys.videoMusic(),
    queryFn: video.music,
    staleTime: 10 * 60 * 1000,
  });
}

/** Màn 27 "Build the story" — 1 call AI (mock được), trả storyboard cho màn 31 sửa. */
export function useStoryboard(familyId: string | null) {
  return useMutation({
    mutationFn: (body: StoryboardRequest) => video.storyboard(familyId as string, body),
  });
}

/** Màn 31 "Make the video" / màn 27 "stitch in my order" — tạo job rồi render luôn. */
export function useCreateAndRender(familyId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateVideoJobRequest) => {
      const job = await video.create(familyId as string, body);
      await video.render(job.id);
      return job;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.videoJobs() }),
  });
}

/** Màn 32 — poll tiến độ 2s/lần tới khi DONE/FAILED ("you can leave this screen"). */
export function useVideoJob(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.videoJob(jobId ?? 'none'),
    queryFn: () => video.job(jobId as string),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const status = (query.state.data as VideoJob | undefined)?.status;
      return status === 'DONE' || status === 'FAILED' ? false : 2000;
    },
  });
}

/** Màn 33 — "Your videos". */
export function useMyVideos() {
  return useQuery({ queryKey: queryKeys.videoJobs(), queryFn: video.list });
}

export function useShareVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, caption }: { jobId: string; caption?: string }) =>
      video.share(jobId, { caption }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.families() }),
  });
}

/**
 * Luồng share mới (26/08): xuất video thành Media rồi mang qua composer để
 * người dùng DUYỆT bài trước khi đăng — thay cho useShareVideo tự tạo post.
 */
export function useExportVideoMedia() {
  return useMutation({
    mutationFn: (jobId: string) => video.exportMedia(jobId),
  });
}
