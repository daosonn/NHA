import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invitations } from '../../lib/api';
import type { CreateInvitationRequest, InvitationSummary } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/**
 * Invitations for one family, newest first.
 *
 * The list carries accepted and cancelled ones too, so callers filter — see
 * `outstanding` below rather than re-deriving the rule at each call site.
 */
export function useFamilyInvitations(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyInvitations(familyId ?? 'none'),
    queryFn: () => invitations.list(familyId as string),
    enabled: familyId !== null,
  });
}

/**
 * The ones still worth showing: sent, not yet accepted, not yet lapsed.
 *
 * `EXPIRED` is computed by the server from `expiresAt` as it reads the row,
 * which means a list fetched before the deadline can be stale on the wrong
 * side of it. The deadline is re-checked here so a banner does not sit on
 * screen inviting somebody whose week ran out while the app was open.
 */
export function outstanding(list: InvitationSummary[], now: number): InvitationSummary[] {
  return list.filter((invite) => invite.status === 'PENDING' && Date.parse(invite.expiresAt) > now);
}

/**
 * Reserves a spot in the tree and issues the code for it.
 *
 * One request, not two: the server creates the placeholder member, its
 * relationship edge and the invitation in a single transaction. That is why
 * this replaced the old add-member-then-add-edge pair, which could leave an
 * unconnected person in the tree whenever the second call failed.
 */
/**
 * Invitations addressed to me and still live.
 *
 * Not scoped to a family, unlike everything else here: the point of this list
 * is families the viewer is *not* in yet, so there is no active family to
 * hang it off.
 */
export function useMyInvitations() {
  return useQuery({
    queryKey: queryKeys.myInvitations(),
    queryFn: () => invitations.mine(),
  });
}

export function useCreateInvitation(familyId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateInvitationRequest) => {
      if (familyId === null) throw new Error('No active family');
      return invitations.create(familyId, body);
    },
    onSuccess: () => {
      if (familyId === null) return;
      // A new placeholder is in the tree, and the family's member count with it.
      void queryClient.invalidateQueries({ queryKey: queryKeys.family(familyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
    },
  });
}

/**
 * Pushes the expiry back by a week.
 *
 * Named for what the button says rather than for what happens: there is no
 * mail out of this endpoint today, so "resend" means the code the inviter
 * already shared starts working again.
 */
export function useResendInvitation(familyId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => {
      if (familyId === null) throw new Error('No active family');
      return invitations.resend(familyId, invitationId);
    },
    onSuccess: () => {
      if (familyId === null) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.familyInvitations(familyId) });
    },
  });
}

/**
 * Withdraws it. The reserved spot goes with it **unless** somebody has
 * already written to that person — the server decides which, and says so in
 * `memberRemoved`, so the tree is refetched either way.
 */
export function useCancelInvitation(familyId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => {
      if (familyId === null) throw new Error('No active family');
      return invitations.cancel(familyId, invitationId);
    },
    onSuccess: () => {
      if (familyId === null) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.family(familyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
    },
  });
}

/**
 * What the invitation page shows before anybody signs in.
 *
 * `retry: false` because the failure that matters here is a code that is
 * wrong, cancelled or lapsed — a 404 or 410 the server means. Retrying those
 * three times only makes the reader wait longer to be told.
 */
export function useInvitationPreview(code: string | null) {
  return useQuery({
    queryKey: queryKeys.invitation(code ?? ''),
    queryFn: () => invitations.preview(code as string),
    enabled: code !== null && code !== '',
    retry: false,
  });
}

/**
 * Takes the spot.
 *
 * Everything about this account's families changes at once — it belongs to
 * one more — so the whole `families` subtree is dropped rather than patched.
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => invitations.accept(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
    },
  });
}
