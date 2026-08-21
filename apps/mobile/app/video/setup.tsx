import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, Music, PenLine } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AddPill } from '../../src/components/ai/add-pill';
import { MemberSheet } from '../../src/components/ai/member-sheet';
import { Pill } from '../../src/components/ai/pill';
import { SelectRow } from '../../src/components/ai/select-row';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton } from '../../src/components/layout/header-slots';
import { Avatar } from '../../src/components/ui/avatar';
import { AvatarStack } from '../../src/components/ui/avatar-stack';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { useActiveFamily } from '../../src/features/family/active-family';
import { clipCountOf, useVideoDraft } from '../../src/features/video/draft';
import { useCreateAndRender, useStoryboard } from '../../src/features/video/use-video';
import { families } from '../../src/lib/api';
import type { VideoTargetSec } from '../../src/lib/api';
import { queryKeys } from '../../src/lib/query-keys';
import { colors, radius, spacing } from '../../src/theme';
import { useTypeface } from '../../src/theme/typeface';
import { useState } from 'react';

/**
 * Màn 27 (11h) — "Story in your own words, length up to 3 min, style, music, photos".
 * "Build the story" = 1 call storyboard → màn 31. "Or just stitch the photos in my order"
 * = chế độ nhanh 0 AI, không caption, không card.
 */

const KINDS = ['year', 'trip', 'birthday', 'memory'] as const;
const LENGTHS: VideoTargetSec[] = [30, 90, 120, 180];

export default function VideoSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { familyId } = useActiveFamily();
  const { draft, update, applyStoryboard } = useVideoDraft();
  const params = useLocalSearchParams<{ memberId?: string; memberName?: string }>();
  const typeface = useTypeface('medium');
  const [memberSheet, setMemberSheet] = useState(false);

  const family = useQuery({
    queryKey: queryKeys.family(familyId ?? 'none'),
    queryFn: () => families.detail(familyId as string),
    enabled: familyId !== null,
  });
  const members = useMemo(() => family.data?.members ?? [], [family.data]);
  const target = members.find((m) => m.id === draft.memberId) ?? members[0] ?? null;

  // Từ hub "Video" — người của dịp nổi bật được chọn sẵn
  useEffect(() => {
    if (params.memberId && draft.memberId === null) {
      update({ memberId: params.memberId, memberName: params.memberName ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.memberId]);

  const storyboard = useStoryboard(familyId);
  const quick = useCreateAndRender(familyId);

  const ready = !!familyId && !!target && draft.mediaIds.length > 0;

  const buildStory = () => {
    if (!ready) return;
    storyboard.mutate(
      {
        memberId: target!.id,
        mediaIds: draft.mediaIds,
        storyRequest: draft.storyRequest || undefined,
        kind: draft.kind,
        kindLabel: draft.customKind || t(`video.kind.${draft.kind}`),
        targetSec: draft.targetSec,
        mood: draft.mood,
        locale: 'ja',
      },
      {
        onSuccess: (sb) => {
          update({ memberId: target!.id, memberName: target!.displayName });
          applyStoryboard(sb);
          router.push('/video/story');
        },
      },
    );
  };

  const stitchQuick = () => {
    if (!ready) return;
    quick.mutate(
      { mediaIds: draft.mediaIds, mode: 'quick', musicId: draft.musicId, aspect: draft.aspect },
      { onSuccess: (job) => router.push({ pathname: '/video/[id]', params: { id: job.id } }) },
    );
  };

  const clipCount = clipCountOf(draft);
  const photoCount = draft.mediaIds.length - clipCount;

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('video.title')}
          </Text>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: 14, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- card 1: về ai + loại + câu chuyện (11h) ---------- */}
        <Card padding={12} style={{ gap: 11 }}>
          <SelectRow
            bare
            leading={<Avatar size={38} name={target?.displayName} avatarKey={target?.avatarKey} />}
            title={target?.displayName ?? t('video.aboutPick')}
            subtitle={t('video.aboutHint')}
            onPress={() => setMemberSheet(true)}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
            {KINDS.map((k) => (
              <Pill
                key={k}
                label={t(`video.kind.${k}`)}
                selected={draft.kind === k && draft.customKind.length === 0}
                onPress={() => update({ kind: k, customKind: '' })}
              />
            ))}
            {/* "+" — dịp của riêng gia đình, không nằm trong bốn loại có sẵn */}
            <AddPill
              value={draft.customKind}
              onChange={(v) => update({ customKind: v })}
              placeholder={t('video.customKindPlaceholder')}
              selected={draft.customKind.length > 0}
              onSelect={() => undefined}
            />
          </ScrollView>

          {/* "Say it in your own words — the narration follows this." */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <TextInput
              value={draft.storyRequest}
              onChangeText={(v) => update({ storyRequest: v })}
              placeholder={t('video.storyPlaceholder')}
              placeholderTextColor={colors.text.subtle}
              multiline
              style={{
                flex: 1,
                minHeight: 52,
                padding: 0,
                ...typeface,
                fontSize: 14,
                lineHeight: 21,
                color: colors.text.primary,
                textAlignVertical: 'top',
              }}
            />
            <PenLine size={15} color={colors.text.lightMuted} strokeWidth={2.1} />
          </View>
          <Text variant="badge" color={colors.text.subtle}>
            {t('video.storyHint')}
          </Text>
        </Card>

        {/* ---------- card 2: Length + Frame ---------- */}
        <Card padding={12} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="body2" weight="semibold" style={{ width: 58 }}>
              {t('video.length')}
            </Text>
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
              {LENGTHS.map((s) => (
                <Pill
                  key={s}
                  label={s === 120 ? t('video.twoMin') : s === 180 ? t('video.threeMin') : `${s}s`}
                  selected={draft.targetSec === s}
                  onPress={() => update({ targetSec: s })}
                />
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="body2" weight="semibold" style={{ width: 58 }}>
              {t('video.frame')}
            </Text>
            <View style={{ flex: 1 }} />
            {/* segmented 9:16 | 16:9 — nút trắng nổi trong rãnh xám */}
            <View style={{ flexDirection: 'row', padding: 3, borderRadius: radius.full, backgroundColor: colors.background.subtle }}>
              {(['portrait', 'landscape'] as const).map((a) => {
                const selected = draft.aspect === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => update({ aspect: a })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={{
                      paddingHorizontal: 15,
                      height: 30,
                      justifyContent: 'center',
                      borderRadius: radius.full,
                      backgroundColor: selected ? colors.background.card : 'transparent',
                      boxShadow: selected ? '0 1px 3px rgba(24,24,27,0.12)' : undefined,
                    }}
                  >
                    <Text variant="caption" weight="semibold" color={selected ? colors.coral.deep : colors.text.muted}>
                      {a === 'portrait' ? '9:16' : '16:9'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        {/* ---------- card 3: Style / Music / Photos ---------- */}
        <Card padding={12} style={{ gap: 0 }}>
          <SelectRow
            bare
            leading={
              <IconBadge
                size={40}
                background="#EFE4D4"
                foreground="#8A6B3E"
                renderIcon={({ size, color }) => <BookOpen size={size} color={color} strokeWidth={2.1} />}
              />
            }
            title={t(`video.styleOpening.${draft.style}`)}
            subtitle={t('video.styleSub')}
            onPress={() => router.push('/video/style')}
          />
          <View style={{ height: 1, backgroundColor: colors.state.borderDefault }} />
          <SelectRow
            bare
            leading={
              <IconBadge
                size={40}
                background={colors.coral.soft}
                foreground={colors.coral.hover}
                renderIcon={({ size, color }) => <Music size={size} color={color} strokeWidth={2.1} />}
              />
            }
            title={draft.musicId === 'none' ? t('video.noMusic') : draft.musicLabel || draft.musicId}
            subtitle={draft.musicId === 'none' ? t('video.musicSub') : draft.musicMeta || null}
            onPress={() => router.push('/video/music')}
          />
          <View style={{ height: 1, backgroundColor: colors.state.borderDefault }} />
          <SelectRow
            bare
            leading={
              <AvatarStack items={[{ id: 'a' }, { id: 'b', tone: 'dark' }, { id: 'c' }]} size={28} surface={colors.background.card} />
            }
            title={
              draft.mediaIds.length === 0
                ? t('video.photosPick')
                : clipCount > 0
                  ? t('video.photosClipsCount', { photos: photoCount, clips: clipCount })
                  : t('video.photosCount', { count: draft.mediaIds.length })
            }
            subtitle={family.data?.name ? t('video.photosFrom', { name: family.data.name }) : null}
            onPress={() => router.push('/video/photos')}
          />
        </Card>

        {(storyboard.isPending || quick.isPending) && (
          <View style={{ alignItems: 'center', paddingVertical: 6 }}>
            <ActivityIndicator color={colors.coral.primary} />
          </View>
        )}

        {storyboard.isError && (
          <Text variant="caption" color={colors.themes.destructive.text} style={{ textAlign: 'center' }}>
            {t('video.storyboardError')}
          </Text>
        )}

        <View style={{ height: 4 }} />
        <Button
          label={t('video.buildStory')}
          variant="primary"
          size="large"
          fullWidth
          disabled={!ready || storyboard.isPending || quick.isPending}
          onPress={buildStory}
        />
        <Pressable
          onPress={stitchQuick}
          disabled={!ready || storyboard.isPending || quick.isPending}
          accessibilityRole="button"
          style={{ alignItems: 'center', paddingVertical: 6 }}
        >
          <Text variant="caption" weight="semibold" color={ready ? colors.coral.hover : colors.state.disabledText}>
            {t('video.stitchQuick')}
          </Text>
        </Pressable>
      </ScrollView>

      <MemberSheet
        visible={memberSheet}
        onClose={() => setMemberSheet(false)}
        members={members}
        selectedId={target?.id ?? null}
        onSelect={(m) => update({ memberId: m.id, memberName: m.displayName })}
      />
    </View>
  );
}
