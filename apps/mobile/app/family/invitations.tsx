import { Clock, Send, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { InviteCodeCard } from '../../src/components/family/invite-code-card';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import { useToast } from '../../src/components/ui/toast';
import { useActiveFamily } from '../../src/features/family/active-family';
import { invitedAsKey } from '../../src/features/family/kinship';
import {
  useCancelInvitation,
  useFamilyInvitations,
  useResendInvitation,
} from '../../src/features/family/use-invitations';
import type { InvitationSummary } from '../../src/lib/api';
import { daysUntil, relativeTime } from '../../src/lib/date';
import { colors, radius } from '../../src/theme';

/**
 * The invitations this family has sent — every one, not just the live ones.
 *
 * This screen replaced the banner that floated over the tree canvas
 * (decided 2026-08-26): the tree is a map, and a card parked on top of it
 * covered the very people being looked at. The list lives behind the
 * paper-plane at the family screen's top right instead, with the waiting
 * count as its badge.
 *
 * A lapsed invitation stays actionable on purpose: `EXPIRED` is derived —
 * the row is still PENDING underneath — so Resend revives the same code and
 * Cancel frees the reserved spot. Without the cancel path an invited
 * PARENT was a permanent ghost in the tree (`member-sheet.tsx` tells that
 * story).
 */

type DisplayStatus = 'live' | 'expired' | 'accepted' | 'cancelled';

/**
 * Where this invitation actually stands. The deadline is re-checked locally,
 * same as `outstanding()`: a list fetched before the deadline can be stale
 * on the wrong side of it.
 */
function displayStatus(invite: InvitationSummary, now: number): DisplayStatus {
  if (invite.status === 'ACCEPTED') return 'accepted';
  if (invite.status === 'CANCELLED') return 'cancelled';
  if (invite.status === 'PENDING' && Date.parse(invite.expiresAt) > now) return 'live';
  return 'expired';
}

export default function SentInvitationsScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { familyId } = useActiveFamily();

  const { data: invites, isPending, isError, refetch } = useFamilyInvitations(familyId);
  const resend = useResendInvitation(familyId);
  const cancel = useCancelInvitation(familyId);

  // Tap a row to reveal its code — the sender who closed the invite sheet
  // without copying gets it back here. One at a time, like the toast.
  const [openId, setOpenId] = useState<string | null>(null);

  const now = Date.now();

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton fallback="/family" />}
        center={<ScreenTitle title={t('family.invitations.title')} />}
      />

      {isError ? (
        <EmptyState
          renderIcon={({ size, color }) => (
            <TriangleAlert size={size} color={color} strokeWidth={2} />
          )}
          title={t('family.invitations.loadFailed')}
          actionLabel={t('common.retry')}
          onActionPress={() => void refetch()}
        />
      ) : isPending ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral.brand} />
        </View>
      ) : (invites ?? []).length === 0 ? (
        <EmptyState
          cat
          renderIcon={({ size, color }) => <Send size={size} color={color} strokeWidth={2} />}
          title={t('family.invitations.emptyTitle')}
          description={t('family.invitations.emptyBody')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ ...contentColumn, paddingTop: 14, paddingBottom: 24, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {(invites ?? []).map((invite) => (
            <InvitationRow
              key={invite.id}
              invite={invite}
              status={displayStatus(invite, now)}
              open={openId === invite.id}
              onToggle={() => setOpenId((current) => (current === invite.id ? null : invite.id))}
              resending={resend.isPending && resend.variables === invite.id}
              cancelling={cancel.isPending && cancel.variables === invite.id}
              onResend={() =>
                resend.mutate(invite.id, {
                  onSuccess: () => toast.success(t('family.toast.resent', { name: invite.name })),
                  onError: () => toast.failure(t('errors.generic')),
                })
              }
              onCancel={() =>
                cancel.mutate(invite.id, {
                  onSuccess: () =>
                    toast.success(t('family.toast.inviteCancelled', { name: invite.name })),
                  onError: () => toast.failure(t('errors.generic')),
                })
              }
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function InvitationRow({
  invite,
  status,
  open,
  onToggle,
  resending,
  cancelling,
  onResend,
  onCancel,
}: {
  invite: InvitationSummary;
  status: DisplayStatus;
  open: boolean;
  onToggle: () => void;
  resending: boolean;
  cancelling: boolean;
  onResend: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  /** A resolved invitation's code is dead — nothing to reveal. */
  const revealable = status === 'live' || status === 'expired';

  const role = t(invitedAsKey(invite.kinshipKey, invite.relationshipType));
  const sent = relativeTime(invite.createdAt);
  const left = daysUntil(invite.expiresAt);

  // Same two facts as the old banner: how long ago, and how long is left —
  // resolved invitations swap the deadline for what became of them.
  const meta = [
    t('family.invitedAs', { role }),
    sent === null ? null : t(sent.key, { count: sent.count }),
    status === 'live' && left !== null ? t('family.invitedExpires', { count: left }) : null,
    status === 'expired' ? t('family.invitations.statusExpired') : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  const settled =
    status === 'accepted'
      ? t('family.invitations.statusAccepted')
      : status === 'cancelled'
        ? t('family.invitations.statusCancelled')
        : null;

  return (
    <View
      style={{
        borderRadius: radius.xl,
        backgroundColor: colors.background.card,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 10,
        // Resolved rows stay listed as history, but dimmed out of the way.
        opacity: settled === null ? 1 : 0.55,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.full,
            backgroundColor: colors.coral.light,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Clock size={17} color={colors.coral.dark} strokeWidth={2} />
        </View>

        {/* The name area is the reveal, its own Pressable rather than the
            whole row — a row-wide button around Resend and Cancel would be
            the nested-<button> trap the group strip is written around. */}
        <Pressable
          onPress={revealable ? onToggle : undefined}
          disabled={!revealable}
          accessibilityRole={revealable ? 'button' : undefined}
          accessibilityLabel={
            revealable ? t('family.invitations.showCode', { name: invite.name }) : undefined
          }
          accessibilityState={revealable ? { expanded: open } : undefined}
          style={{ flex: 1, gap: 1 }}
        >
          <Text variant="caption" weight="semibold" numberOfLines={1}>
            {invite.name}
          </Text>
          <Text variant="badge" color={colors.text.subtle} numberOfLines={1}>
            {meta}
          </Text>
        </Pressable>

        <RowActions />
      </View>

      {open && revealable && (
        <InviteCodeCard
          code={invite.code}
          subtitle={
            status === 'expired'
              ? t('family.invitations.expiredCodeHint')
              : left !== null
                ? t('family.invitedExpires', { count: left })
                : ''
          }
        />
      )}
    </View>
  );

  function RowActions() {
    if (settled !== null) {
      return (
        <Text variant="badge" weight="medium" color={colors.text.subtle}>
          {settled}
        </Text>
      );
    }
    if (resending || cancelling) {
      return <ActivityIndicator size="small" color={colors.coral.brand} />;
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable
          onPress={onResend}
          accessibilityRole="button"
          accessibilityLabel={t('family.resendFor', { name: invite.name })}
          hitSlop={8}
        >
          <Text variant="badge" weight="semibold" color={colors.coral.deep}>
            {t('family.resend')}
          </Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('family.cancelFor', { name: invite.name })}
          hitSlop={8}
        >
          <Text variant="badge" weight="semibold" color={colors.text.muted}>
            {t('family.invitations.cancel')}
          </Text>
        </Pressable>
      </View>
    );
  }
}
