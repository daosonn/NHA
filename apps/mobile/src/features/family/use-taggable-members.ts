import { useQueries } from '@tanstack/react-query';

import { families } from '../../lib/api';
import type { FamilyMemberSummary } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

export type TaggableMember = FamilyMemberSummary & {
  /** True when this row is the signed-in account, so the picker can say "You". */
  isViewer: boolean;
};

/**
 * Everyone who can be tagged in a moment, given who it is being posted to.
 *
 * The server validates tags against the post's audience — `validateTags` in
 * `post.service.ts` refuses a member who is not in one of the `familyIds` —
 * so the picker has to offer exactly that union and no more. A moment shared
 * with two families can name people from both; deselect a family and its
 * people stop being taggable.
 *
 * `useQueries` rather than a loop of `useQuery`, because the number of
 * families changes as the audience is toggled and hooks cannot be called
 * conditionally.
 *
 * Deduplicated by member id, which matters more than it looks: the same
 * *person* has a different member row in each family, so somebody in both
 * families appears twice and must be tagged in both places. Two rows, two
 * ids, both kept — it is the ids that are deduplicated, not the people.
 */
export function useTaggableMembers(
  familyIds: string[],
  viewerUserId: string | null,
): TaggableMember[] {
  const results = useQueries({
    queries: familyIds.map((familyId) => ({
      queryKey: queryKeys.family(familyId),
      queryFn: () => families.detail(familyId),
    })),
  });

  const seen = new Set<string>();
  const members: TaggableMember[] = [];

  for (const result of results) {
    for (const member of result.data?.members ?? []) {
      if (seen.has(member.id)) continue;
      seen.add(member.id);
      members.push({
        ...member,
        isViewer: viewerUserId !== null && member.userId === viewerUserId,
      });
    }
  }

  // You first — most moments are your own — then everybody else by name, so
  // the list does not reshuffle when a family finishes loading.
  return members.sort((a, b) => {
    if (a.isViewer !== b.isViewer) return a.isViewer ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}
