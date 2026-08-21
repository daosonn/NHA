import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { ScreenTitle } from '../../src/components/layout/header-slots';
import { AudiencePicker, type AudienceGroup } from '../../src/components/moment/audience-picker';
import { MediaStrip, type DraftMedia } from '../../src/components/moment/media-strip';
import { MemberTagPicker } from '../../src/components/moment/member-tag-picker';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useSession } from '../../src/features/auth/session';
import { useFamilies } from '../../src/features/family/use-families';
import { useTaggableMembers } from '../../src/features/family/use-taggable-members';
import { momentErrorKey } from '../../src/features/moment/moment-error';
import { useCreateMoment } from '../../src/features/moment/use-create-moment';
import type { FamilySummary } from '../../src/lib/api';
import { colors, spacing } from '../../src/theme';

/** Clears the bottom nav (56pt plus the home indicator) with room to breathe. */
const BOTTOM_INSET = 140;

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

  const ready = caption.trim() !== '' || media.length > 0;

  const submit = () => {
    create.mutate(
      {
        content: caption,
        media,
        familyIds: selected.map((group) => group.id),
        taggedMemberIds: tagged,
      },
      {
        onSuccess: () => {
          setCaption('');
          setMedia([]);
          setExcludedIds([]);
          setTaggedIds([]);
          router.replace('/');
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
    <View className="flex-1 bg-page">
      <AppHeader center={<ScreenTitle title={t('moment.title')} />} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: BOTTOM_INSET, gap: 20 }}
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
            label={postLabel}
            size="large"
            fullWidth
            disabled={!ready}
            loading={create.isPending}
            onPress={submit}
            renderIcon={({ size, color }) => <Send size={size} color={color} strokeWidth={2.1} />}
          />

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
    </View>
  );
}
