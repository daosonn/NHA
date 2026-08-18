import { useQuery } from '@tanstack/react-query';

import { families } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/** Nodes and edges for one family. Layout stays on the client. */
export function useFamilyTree(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyTree(familyId ?? 'none'),
    queryFn: () => families.tree(familyId as string),
    enabled: familyId !== null,
  });
}
