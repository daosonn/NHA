import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Play, Send, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppHeader } from '../src/components/layout/app-header';
import { contentColumn } from '../src/components/layout/content-column';
import { CloseButton, ScreenTitle } from '../src/components/layout/header-slots';
import { AudiencePicker, type AudienceGroup } from '../src/components/moment/audience-picker';
import { MediaStrip, type DraftMedia } from '../src/components/moment/media-strip';
import { MemberTagPicker } from '../src/components/moment/member-tag-picker';
import { useScreenSheet } from '../src/components/motion/screen-sheet';
import { Button } from '../src/components/ui/button';
import { SheetModal } from '../src/components/ui/sheet-modal';
import { Text } from '../src/components/ui/text';
import { TextField } from '../src/components/ui/text-field';
import { useToast } from '../src/components/ui/toast';
import { useSession } from '../src/features/auth/session';
import { useFamilies } from '../src/features/family/use-families';
import { useTaggableMembers } from '../src/features/family/use-taggable-members';
import { momentErrorKey } from '../src/features/moment/moment-error';
import { useCreateMoment } from '../src/features/moment/use-create-moment';
import { collapseTo, useSafeBack } from '../src/lib/back';
import type { FamilySummary } from '../src/lib/api';
import { thumbnailSource } from '../src/lib/media-source';
import { colors, elevation, radius, spacing } from '../src/theme';

function toAudience(families: FamilySummary[]): AudienceGroup[] {
  return families.map((family) => ({
    id: family.id,
    name: family.name,
    memberCount: family.memberCount,
    coverMediaId: family.coverMediaId,
  }));
}

/** Milliseconds from the picker to the `0:12` the tile draws. */
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function toDraft(asset: ImagePicker.ImagePickerAsset, index: number): DraftMedia {
  const isVideo = asset.type === 'video';
  // `assetId` is null on web and `uri` is a `blob:` URL there, so neither
  // makes a sane filename. The uri still works as a key because two picks of
  // the same file produce two different object URLs.
  const id = asset.assetId ?? `${asset.uri}#${index}`;

  return {
    id,
    kind: isVideo ? 'video' : 'photo',
    tone: 'light',
    uri: asset.uri,
    fileName: asset.fileName ?? `moment-${index}.${isVideo ? 'mp4' : 'jpg'}`,
    mimeType: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
    duration:
      isVideo && asset.duration !== null && asset.duration !== undefined
        ? formatDuration(asset.duration)
        : undefined,
  };
}

export default function NewMomentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const close = useSafeBack('/');
  // The screen's own rise-and-drop. Every exit goes through `dismiss` so
  // the drop always plays; `close` only ever runs when it finishes.
  const { scrimStyle, panelStyle, dismiss } = useScreenSheet(close);
  const toast = useToast();
  // Thiệp/video AI vừa tạo được đưa sang đây để DUYỆT trước khi đăng (Sơn
  // chốt 26/08): media đã nằm trên server nên chỉ mang id + mime.
  const params = useLocalSearchParams<{
    attachMediaId?: string;
    attachMime?: string;
    tagMemberId?: string;
    caption?: string;
    /** '1' starts with every family unticked — a picture kept to yourself. */
    private?: string;
  }>();

  const { user } = useSession();
  const { data: families } = useFamilies();
  const create = useCreateMoment();

  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  // Excluded rather than selected: everything starts lit, and the
  // destructive direction is the one that needs a deliberate tap.
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [attached, setAttached] = useState<{ id: string; mime: string } | null>(null);

  // Áp prefill bằng effect + đánh dấu đã dùng: params có thể đến sau lần
  // render đầu, và cùng một màn không được đổ lại hàng cũ.
  const consumed = useRef<string | null>(null);
  useEffect(() => {
    const id = params.attachMediaId;
    if (!id || consumed.current === id) return;
    consumed.current = id;
    setAttached({ id, mime: params.attachMime ?? 'image/png' });
    if (params.caption) setCaption(params.caption);
    if (params.tagMemberId) {
      const tagId = params.tagMemberId;
      setTaggedIds((current) => (current.includes(tagId) ? current : [...current, tagId]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.attachMediaId]);

  // Arriving from "add a private photo": untick everything once the
  // families are known. Not initial state — they load after the first
  // render, so there is nothing to exclude yet at that point. The ref makes
  // it a one-off, or re-ticking a family here would be undone on every
  // render while the flag is still in the URL.
  const wentPrivate = useRef(false);
  useEffect(() => {
    if (params.private !== '1' || wentPrivate.current || families === undefined) return;
    wentPrivate.current = true;
    setExcludedIds(families.map((family) => family.id));
  }, [params.private, families]);

  const audience = families === undefined ? [] : toAudience(families);
  const selected = audience.filter((group) => !excludedIds.includes(group.id));
  const excluded = audience.filter((group) => excludedIds.includes(group.id));

  const taggable = useTaggableMembers(
    selected.map((group) => group.id),
    user?.id ?? null,
  );

  /**
   * Dropping a family drops the people who were only in it.
   *
   * The server refuses a tag whose member is not in the post's audience, so
   * leaving them selected would turn an ordinary "actually, not that family"
   * into a 400 on the way out — with nothing on screen to explain it.
   */
  const tagged = taggedIds.filter((id) => taggable.some((member) => member.id === id));

  const toggle = (group: AudienceGroup) =>
    setExcludedIds((current) =>
      current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id],
    );

  const toggleTag = (memberId: string) =>
    setTaggedIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }

    setPermissionDenied(false);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) return;
    setMedia((current) => [...current, ...result.assets.map(toDraft)]);
  };

  const ready = caption.trim() !== '' || media.length > 0 || attached !== null;

  /** Đang có video phải TẢI LÊN — bước chậm nhất, nói trước để đỡ sốt ruột. */
  const uploadingVideo =
    create.isPending &&
    (media.some((m) => m.kind === 'video') || (attached?.mime.startsWith('video/') ?? false));

  /**
   * The ✕. The draft lives only in this screen's state, so closing *is*
   * deleting it — anything written or attached gets the "keep editing or
   * discard?" sheet first. An untouched screen just drops back down.
   */
  const requestClose = () => {
    if (ready) setConfirmingDiscard(true);
    else dismiss();
  };

  const discard = () => {
    setConfirmingDiscard(false);
    dismiss();
  };

  const submit = () => {
    create.mutate(
      {
        content: caption,
        media,
        familyIds: selected.map((group) => group.id),
        taggedMemberIds: tagged,
        attachedMediaIds: attached === null ? [] : [attached.id],
      },
      {
        onSuccess: () => {
          setCaption('');
          setMedia([]);
          setExcludedIds([]);
          setTaggedIds([]);
          setAttached(null);
          // Nói ra là đã đăng — về Home im lặng thì người dùng không chắc
          // bài đã đi hay chưa.
          toast.success(t('moment.posted'));
          // Đăng xong là về HOME (Sơn chốt 27/08): mở từ màn thiệp/video thì
          // rơi lại màn đó là vô nghĩa — việc đã xong, bài nằm ở Home. Gỡ
          // cả chồng bên dưới (collapseTo) chứ không pop một nấc; ✕ hủy vẫn
          // đi lối mặc định về màn cũ để còn sửa tiếp.
          dismiss(() => collapseTo(router, '/'));
        },
      },
    );
  };

  // A count of families, worded so "1" does not read as a bug.
  const postLabel =
    selected.length === 0
      ? t('moment.postPrivately')
      : t('moment.postTo', { count: selected.length });

  return (
    // Transparent at the root — the route is a transparentModal, so what
    // shows through here during the motion is the tab this screen rose over.
    <View style={{ flex: 1 }}>
      {/* Fades in step with the panel. Not pressable: the panel covers the
          whole screen at rest, so unlike a sheet's scrim there is nothing
          this could be a close target for. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.state.scrim,
          },
          scrimStyle,
        ]}
      />

      <Animated.View style={[{ flex: 1, backgroundColor: colors.background.page }, panelStyle]}>
        {/* An ✕, not a back chevron: the screen rises from the bottom
            (`useScreenSheet`) and drops back down, and the ✕ is the only way
            out — the stack's back gesture is off so nothing can sidestep the
            discard question. */}
        <AppHeader
          left={<CloseButton onPress={requestClose} />}
          center={<ScreenTitle title={t('moment.title')} />}
        />

        <ScrollView
          contentContainerStyle={{
            ...contentColumn,
            paddingTop: spacing.xl,
            // A pushed Stack screen sits above the tab bar, so nothing floats
            // over the end of this scroll and no BOTTOM_INSET is owed.
            paddingBottom: spacing['4xl'],
            gap: 20,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label={t('moment.caption')}
            value={caption}
            onChangeText={setCaption}
            placeholder={t('moment.captionPlaceholder')}
            multiline
          />

          <View style={{ gap: 2 }}>
            <Text variant="body1" weight="semibold">
              {t('moment.media')}
            </Text>

            {/* Thiệp/video vừa tạo bên AI — bỏ được như mọi ảnh khác (✕ là nút
                ANH EM đè góc, không lồng Pressable) */}
            {attached !== null && (
              <View style={{ width: 96, height: 96, marginTop: 8 }}>
                <Image
                  source={thumbnailSource(attached.id, attached.mime)}
                  style={{ width: '100%', height: '100%', borderRadius: radius.xl }}
                  contentFit="cover"
                />
                {attached.mime.startsWith('video/') && (
                  <View
                    style={{
                      position: 'absolute',
                      inset: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    pointerEvents="none"
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: radius.full,
                        backgroundColor: 'rgba(0,0,0,0.45)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Play size={14} color={colors.text.white} fill={colors.text.white} />
                    </View>
                  </View>
                )}
                <Pressable
                  onPress={() => setAttached(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  hitSlop={8}
                  style={{
                    position: 'absolute',
                    right: -6,
                    top: -6,
                    width: 22,
                    height: 22,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.text.primary,
                  }}
                >
                  <X size={12} color={colors.text.white} strokeWidth={2.6} />
                </Pressable>
              </View>
            )}

            <MediaStrip
              media={media}
              onAdd={() => void pick()}
              onRemove={(item) => setMedia((current) => current.filter((m) => m.id !== item.id))}
            />

            {permissionDenied && (
              <Text variant="caption" color={colors.themes.destructive.text}>
                {t('moment.permissionDenied')}
              </Text>
            )}
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ gap: 2 }}>
              <Text variant="body1" weight="semibold">
                {t('moment.shareWith')}
              </Text>
              <Text variant="body2" color={colors.text.body}>
                {t('moment.shareWithHint')}
              </Text>
            </View>

            {audience.length === 0 ? (
              <Text variant="body2" color={colors.text.subtle}>
                {t('moment.noFamilies')}
              </Text>
            ) : (
              <AudiencePicker
                groups={audience}
                selected={selected.map((group) => group.id)}
                onToggle={toggle}
              />
            )}
          </View>

          {/* Below the audience, because who can be named depends on who the
            moment is going to. */}
          <MemberTagPicker members={taggable} selected={tagged} onToggle={toggleTag} />

          <View style={{ gap: 10 }}>
            {create.error !== null && (
              <Text
                variant="caption"
                color={colors.themes.destructive.text}
                accessibilityRole="alert"
                style={{ textAlign: 'center' }}
              >
                {t(momentErrorKey(create.error))}
              </Text>
            )}

            <Button
              label={create.isPending ? t('moment.posting') : postLabel}
              size="large"
              fullWidth
              disabled={!ready}
              loading={create.isPending}
              onPress={submit}
              renderIcon={({ size, color }) => <Send size={size} color={color} strokeWidth={2.1} />}
            />

            {uploadingVideo && (
              <Text variant="caption" color={colors.text.subtle} style={{ textAlign: 'center' }}>
                {t('moment.postingVideoHint')}
              </Text>
            )}

            {/* Saying who is excluded is the whole point of the dimmed state —
              a count alone would not tell you *which* family you dropped. */}
            <Text variant="caption" color={colors.text.subtle} style={{ textAlign: 'center' }}>
              {selected.length === 0
                ? t('moment.explainPrivate')
                : excluded.length === 0
                  ? t('moment.explainEveryone')
                  : t('moment.explainSkipped', {
                      count: excluded.length,
                      names: excluded.map((group) => group.name).join(', '),
                    })}
            </Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* "Keep editing or discard?" — confirmed inside one sheet, the same
          shape as the comment-delete confirm: dismissing one Modal and
          presenting another on the same tick has overlapped before. The
          scrim and the neutral button both mean "keep editing". */}
      <SheetModal
        visible={confirmingDiscard}
        onClose={() => setConfirmingDiscard(false)}
        scrimLabel={t('moment.discard.keep')}
      >
        <View
          style={[
            {
              borderTopLeftRadius: radius['7xl'],
              borderTopRightRadius: radius['7xl'],
              backgroundColor: colors.background.page,
              paddingTop: 10,
              paddingHorizontal: 20,
              paddingBottom: 26,
              gap: 14,
            },
            elevation.sheet,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 5,
              borderRadius: radius.full,
              backgroundColor: '#E2DCD7',
            }}
          />

          <View style={{ alignItems: 'center', gap: 12, paddingTop: 4 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.full,
                backgroundColor: colors.coral.light,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={24} color={colors.coral.deep} strokeWidth={2} />
            </View>

            <Text
              variant="h2"
              weight="bold"
              accessibilityRole="header"
              style={{ letterSpacing: -0.3, textAlign: 'center' }}
            >
              {t('moment.discard.title')}
            </Text>

            <Text variant="body2" color={colors.text.muted} style={{ textAlign: 'center' }}>
              {t('moment.discard.body')}
            </Text>

            <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>
              <Button
                label={t('moment.discard.confirm')}
                variant="destructiveSolid"
                size="large"
                fullWidth
                onPress={discard}
              />
              <Button
                label={t('moment.discard.keep')}
                variant="neutral"
                size="large"
                fullWidth
                onPress={() => setConfirmingDiscard(false)}
              />
            </View>
          </View>
        </View>
      </SheetModal>
    </View>
  );
}
