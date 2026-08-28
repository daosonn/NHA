import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DraftMedia } from '../../components/moment/media-strip';
import { profiles } from '../../lib/api';
import type { ProfileDetail, UpdateProfileRequest } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { uploadDrafts } from '../moment/upload-drafts';

/**
 * The signed-in account's own Life Profile.
 *
 * One profile per person, global across every family they belong to
 * (`docs/00-shared/domain-model.md`), which is why this key sits outside the
 * `families` subtree.
 */
export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.myProfile(),
    queryFn: () => profiles.mine(),
  });
}

/**
 * Somebody else's, read through the family you are viewing them from.
 *
 * A **linked** member's route serves their global profile — the same object
 * `useMyProfile` reads. A placeholder serves that family's wiki profile.
 */
export function useMemberProfile(familyId: string | null, memberId: string | null) {
  return useQuery({
    queryKey: queryKeys.memberProfile(familyId ?? '', memberId ?? ''),
    queryFn: () => profiles.member(familyId as string, memberId as string),
    enabled: familyId !== null && memberId !== null,
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => profiles.updateMine(body),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.myProfile(), detail);
      // The same person is read through every family they belong to.
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
      // And every post already on screen carries its author's name, so a
      // rename leaves the old one sitting in the feed until something else
      // happens to refetch it.
      void queryClient.invalidateQueries({ queryKey: queryKeys.myFeed() });
    },
  });
}

/**
 * Edit a profile reached through a family — in practice, your own, opened by
 * tapping your node in the tree.
 *
 * It does not rename anybody. A name is not part of the profile: for an
 * account it is `User.name`, and for a placeholder it lives on the
 * `FamilyMember` row. Renaming a placeholder belongs to the family screen,
 * with the rest of that person's place in the tree (decided 2026-08-19).
 */
export function useUpdateMemberProfile(familyId: string | null, memberId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => {
      if (familyId === null || memberId === null) throw new Error('No member to edit');
      return profiles.updateMember(familyId, memberId, body);
    },
    onSuccess: (detail) => {
      if (familyId === null || memberId === null) return;

      queryClient.setQueryData(queryKeys.memberProfile(familyId, memberId), detail);
      // The tree carries the name, so a rename has to reach it too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.family(familyId) });
    },
  });
}

/**
 * Puts a photograph on your own profile.
 *
 * Upload first, then point the profile at it: `avatarMediaId` takes a
 * `Media` id, and the server refuses one this account did not upload. Two
 * requests, not one — there is no multipart profile endpoint and there should
 * not be, because the same picture goes through the same `POST /media` as
 * everything else.
 *
 * Only ever your own. A placeholder's picture is something the family sets
 * from the tree, which is the same rule the rest of the profile follows.
 */
export function useUpdateAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draft: DraftMedia | null): Promise<ProfileDetail> => {
      if (draft === null) return profiles.updateMine({ avatarMediaId: null });

      const [mediaId] = await uploadDrafts([draft]);
      if (mediaId === undefined) throw new Error('Upload produced no media');

      return profiles.updateMine({ avatarMediaId: mediaId });
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.myProfile(), detail);
      // The face is drawn from the tree in the feed, the strip and the
      // canvas, so every family this person belongs to is now stale.
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
    },
  });
}
