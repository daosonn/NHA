import { useLocalSearchParams, useRouter } from 'expo-router';
import { ImageOff } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { ScreenTitle } from '../../src/components/layout/header-slots';
import { AudiencePicker, type AudienceGroup } from '../../src/components/moment/audience-picker';
import { MemberTagPicker } from '../../src/components/moment/member-tag-picker';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useToast } from '../../src/components/ui/toast';
import { useSession } from '../../src/features/auth/session';
import { useFamilies } from '../../src/features/family/use-families';
import { useTaggableMembers } from '../../src/features/family/use-taggable-members';
import { useUpdatePost, usePost } from '../../src/features/feed/use-post';
import { momentErrorKey } from '../../src/features/moment/moment-error';
import type { FamilySummary, PostDetail, UpdatePostRequest } from '../../src/lib/api';
import { safeBack } from '../../src/lib/back';
import { dayOnly } from '../../src/lib/date';
import { colors, spacing } from '../../src/theme';

/** `YYYY-MM-DD` — what the API stores and `src/lib/date.ts` reads. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toAudience(families: FamilySummary[]): AudienceGroup[] {
  return families.map((family) => ({
    id: family.id,
    name: family.name,
    memberCount: family.memberCount,
    coverMediaId: family.coverMediaId,
  }));
}

/** So sánh hai tập id, không quan tâm thứ tự. */
function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * Sửa một bài đã đăng — caption, nơi chốn, (với EVENT) tiêu đề + ngày, đối
 * tượng chia sẻ và tag. Ảnh/clip cố định từ lúc đăng, cùng luật với memo và
 * mốc đời, nên ở đây chỉ nói ra chứ không bày picker.
 *
 * Chỉ tác giả tới được màn này (nút ⋯ chỉ vẽ khi `canEdit`), và server còn
 * chặn lần nữa (403).
 */
export default function PostEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const query = usePost(id ?? null);

  if (query.isPending || query.data === undefined) {
    return (
      <View className="flex-1 bg-page">
        <AppHeader />
        <View style={{ paddingTop: 48, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      </View>
    );
  }

  return (
    <PostEditForm
      post={query.data}
      onDone={() => safeBack(router, '/')}
      onCancel={() => safeBack(router, '/')}
    />
  );
}

/** Tách riêng để useState seed được từ bài đã tải xong (bài học memo/edit). */
function PostEditForm({
  post,
  onDone,
  onCancel,
}: {
  post: PostDetail;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useSession();
  const { data: families } = useFamilies();
  const update = useUpdatePost(post.id);

  const [content, setContent] = useState(post.content ?? '');
  const [place, setPlace] = useState(post.place ?? '');
  const [eventTitle, setEventTitle] = useState(post.eventTitle ?? '');
  const [eventDate, setEventDate] = useState(
    post.eventDate === null ? '' : dayOnly(post.eventDate),
  );
  const [taggedIds, setTaggedIds] = useState<string[]>(post.taggedMemberIds);
  // Cùng chiều với composer: loại trừ chứ không chọn — mọi nhà sáng sẵn,
  // hướng phá hoại mới cần bấm chủ đích. Seed = những nhà bài CHƯA chia sẻ.
  const [excludedIds, setExcludedIds] = useState<string[]>(() =>
    (families ?? []).map((f) => f.id).filter((fid) => !post.familyIds.includes(fid)),
  );

  const audience = families === undefined ? [] : toAudience(families);
  const selected = audience.filter((group) => !excludedIds.includes(group.id));

  const taggable = useTaggableMembers(
    selected.map((group) => group.id),
    user?.id ?? null,
  );
  // Rút một nhà khỏi bài là rút luôn tag của người chỉ ở nhà đó — server
  // từ chối tag ngoài đối tượng chia sẻ (validateTags).
  const tagged = taggedIds.filter((tagId) => taggable.some((member) => member.id === tagId));

  const toggle = (group: AudienceGroup) =>
    setExcludedIds((current) =>
      current.includes(group.id) ? current.filter((x) => x !== group.id) : [...current, group.id],
    );

  const toggleTag = (memberId: string) =>
    setTaggedIds((current) =>
      current.includes(memberId) ? current.filter((x) => x !== memberId) : [...current, memberId],
    );

  const isEvent = post.type === 'EVENT';
  const dateProblem = isEvent && eventDate.trim() !== '' && !ISO_DATE.test(eventDate.trim());
  // EVENT không được xóa trắng tiêu đề/ngày (server 400); POST thường chỉ cần
  // còn chữ hoặc còn ảnh.
  const ready = isEvent
    ? eventTitle.trim() !== '' && ISO_DATE.test(eventDate.trim())
    : content.trim() !== '' || post.media.length > 0;

  const save = () => {
    if (!ready) return;

    const selectedIds = selected.map((group) => group.id);
    const body: UpdatePostRequest = {
      ...(content.trim() !== (post.content ?? '') && { content: content.trim() }),
      ...(place.trim() !== (post.place ?? '') && { place: place.trim() }),
      // Hai mảng là THAY CẢ TẬP — đổi thì gửi đủ, không đổi thì đừng gửi.
      ...(!sameIds(selectedIds, post.familyIds) && { familyIds: selectedIds }),
      ...(!sameIds(tagged, post.taggedMemberIds) && { taggedMemberIds: tagged }),
      // Chỉ EVENT mới có hai trường này — gửi cho POST thường là 400.
      ...(isEvent &&
        eventTitle.trim() !== (post.eventTitle ?? '') && { eventTitle: eventTitle.trim() }),
      ...(isEvent &&
        eventDate.trim() !== dayOnly(post.eventDate ?? '') && { eventDate: eventDate.trim() }),
    };

    update.mutate(body, {
      onSuccess: () => {
        toast.success(t('post.edit.saved'));
        onDone();
      },
    });
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={
          <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={8}>
            <Text variant="body1" weight="medium" color={colors.text.muted}>
              {t('member.memoEditor.cancel')}
            </Text>
          </Pressable>
        }
        center={<ScreenTitle title={t('post.edit.title')} />}
        right={
          <Pressable
            onPress={save}
            disabled={!ready || update.isPending}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            hitSlop={8}
          >
            <Text
              variant="body1"
              weight="semibold"
              color={ready ? colors.coral.deep : colors.state.disabledText}
            >
              {t('member.memoEditor.save')}
            </Text>
          </Pressable>
        }
        paddingRight={spacing.xl}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40, gap: 18 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isEvent && (
          <>
            <TextField
              label={t('post.edit.eventTitleLabel')}
              value={eventTitle}
              onChangeText={setEventTitle}
              maxLength={200}
            />
            <TextField
              label={t('post.edit.eventDateLabel')}
              value={eventDate}
              onChangeText={setEventDate}
              placeholder={t('profileEdit.datePlaceholder')}
              hint={dateProblem ? undefined : t('profileEdit.dateHint')}
              error={dateProblem ? t('post.edit.dateError') : undefined}
            />
          </>
        )}

        <TextField
          label={t('moment.caption')}
          value={content}
          onChangeText={setContent}
          placeholder={t('moment.captionPlaceholder')}
          multiline
        />

        <TextField
          label={t('post.edit.placeLabel')}
          value={place}
          onChangeText={setPlace}
          placeholder={t('post.edit.placePlaceholder')}
          maxLength={200}
        />

        {/* Ảnh cố định từ lúc đăng — nói ra thay vì bày picker rồi vứt ảnh đi lúc lưu */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <ImageOff size={14} color={colors.text.subtle} strokeWidth={2} />
          <Text variant="caption" color={colors.text.subtle} style={{ flex: 1 }}>
            {t('post.edit.mediaFixed', { count: post.media.length })}
          </Text>
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

        <MemberTagPicker members={taggable} selected={tagged} onToggle={toggleTag} />

        {update.error !== null && (
          <Text
            variant="caption"
            color={colors.themes.destructive.text}
            accessibilityRole="alert"
            style={{ textAlign: 'center' }}
          >
            {t(momentErrorKey(update.error))}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
