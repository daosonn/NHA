import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ellipsis, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { ContentColumn, contentColumn } from '../../src/components/layout/content-column';
import { useToast } from '../../src/components/ui/toast';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { MemoActionsSheet } from '../../src/components/member/memo-actions-sheet';
import { categoryChip } from '../../src/components/member/memo-card';
import { Chip } from '../../src/components/ui/chip';
import { EmptyState } from '../../src/components/ui/empty-state';
import { PhotoPlaceholder } from '../../src/components/ui/photo-placeholder';
import { Text } from '../../src/components/ui/text';
import { TextLink } from '../../src/components/ui/text-link';
import { useDeleteMemo, useMemo } from '../../src/features/member/use-memos';
import { relativeTime } from '../../src/lib/date';
import { colors, elevation, radius, spacing } from '../../src/theme';
import { goBack } from '../../src/lib/navigation';

/** Room for the floating action bar. */
const BOTTOM_INSET = 120;

const PHOTO_GAP = 8;

/**
 * One note, opened from the Memo tab.
 *
 * A note is a private thing the reader wrote themselves, so the screen is a
 * page rather than a card: full-width text, no author, nothing between the
 * words and the photos that go with them.
 *
 * Reached by memo id alone. That matters for an orphaned note — one whose
 * member has left the family — because its member-scoped route no longer
 * exists but the note is still yours to read (`api-contract.md` → Memos).
 */
export default function MemoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useMemo(id);
  const deleteMemo = useDeleteMemo();

  const [actionsOpen, setActionsOpen] = useState(false);

  const memo = query.data;

  const openEditor = () => {
    router.push({ pathname: '/memo/edit', params: { id } });
  };

  const confirmDelete = () => {
    if (memo === undefined) return;

    setActionsOpen(false);
    // Leave first, delete second: the list this note came from is behind us,
    // and the screen would otherwise flash its "gone" state on the way out.
    goBack();
    deleteMemo.mutate(memo, {
      onSuccess: () => toast.success(t('member.memoDelete.toast')),
      onError: () => toast.failure(t('errors.generic')),
    });
  };

  const written = memo === undefined ? null : relativeTime(memo.createdAt);
  const edited = memo === undefined ? null : relativeTime(memo.updatedAt);
  const wasEdited = memo !== undefined && memo.updatedAt !== memo.createdAt;
  const chip = memo === undefined ? null : categoryChip(memo.category);

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => goBack()} />}
        center={<ScreenTitle title={t('member.memoDetail.title')} />}
        right={
          memo === undefined ? undefined : (
            <Pressable
              onPress={() => setActionsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('member.memoDetail.actions')}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                backgroundColor: colors.background.subtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ellipsis size={19} color={colors.text.secondary} strokeWidth={2.4} />
            </Pressable>
          )
        }
      />

      {query.isPending ? (
        <View style={{ paddingTop: 48, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      ) : memo === undefined ? (
        <View style={{ padding: spacing.xl }}>
          <EmptyState
            renderIcon={(props) => <Pencil {...props} strokeWidth={2} />}
            title={t('member.memoDetail.gone')}
            description={t('member.memoDetail.goneBody')}
          />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              ...contentColumn,
              paddingTop: 18,
              paddingBottom: BOTTOM_INSET,
              gap: 14,
            }}
            showsVerticalScrollIndicator={false}
          >
            {chip !== null && chip.label !== null && (
              <View style={{ alignSelf: 'flex-start' }}>
                <Chip
                  label={chip.theme === 'neutral' ? chip.label : t(chip.label)}
                  theme={chip.theme}
                  showDot
                />
              </View>
            )}

            <View style={{ gap: 6 }}>
              <Text
                weight="bold"
                accessibilityRole="header"
                style={{ fontSize: 25, lineHeight: 32, letterSpacing: -0.5 }}
              >
                {memo.title}
              </Text>

              <Text variant="caption" color={colors.text.subtle}>
                {written === null
                  ? t('member.memoDetail.about', { name: memo.aboutName })
                  : t('member.memoDetail.aboutWhen', {
                      name: memo.aboutName,
                      when:
                        wasEdited && edited !== null
                          ? t('member.memoDetail.metaEdited', {
                              written: t(written.key, { count: written.count }),
                              edited: t(edited.key, { count: edited.count }),
                            })
                          : t(written.key, { count: written.count }),
                    })}
              </Text>
            </View>

            {memo.content !== null &&
              memo.content
                .split('\n\n')
                .filter((paragraph: string) => paragraph.trim() !== '')
                .map((paragraph: string, index: number) => (
                  <Text
                    key={index}
                    color={colors.text.body}
                    style={{ fontSize: 15, lineHeight: 25 }}
                  >
                    {paragraph}
                  </Text>
                ))}

            {memo.media.length > 0 && (
              <>
                <Text variant="body2" weight="semibold" color={colors.text.secondary}>
                  {t('member.memoDetail.photos', { count: memo.media.length })}
                </Text>
                <PhotoGrid count={memo.media.length} />
              </>
            )}

            {/* Attachments are fixed at creation, like a post's, so there is
                no "add photo" to offer — only the words can still change. */}
            {memo.media.length === 0 && (
              <TextLink label={t('member.memoDetail.edit')} onPress={openEditor} />
            )}
          </ScrollView>

          {/* Only the edit action is drawn. The mockup's bare image and link
              icons have nothing behind them, and a dead control costs more
              trust than a visibly missing one. */}
          {/* Pinned to the column's right edge rather than the window's: at
              1440 those are 400px apart and only one of them is anywhere near
              the memo. The strip carrying it now spans the width, so it is
              `box-none` — otherwise it would swallow the scroll. */}
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: 34 }}
            pointerEvents="box-none"
          >
            <ContentColumn style={{ alignItems: 'flex-end' }} pointerEvents="box-none">
              <Pressable
                onPress={openEditor}
                accessibilityRole="button"
                accessibilityLabel={t('member.memoDetail.edit')}
                style={[
                  {
                    width: 46,
                    height: 46,
                    borderRadius: radius.full,
                    backgroundColor: colors.coral.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  elevation.floating,
                ]}
              >
                <Pencil size={21} color={colors.text.white} strokeWidth={2.1} />
              </Pressable>
            </ContentColumn>
          </View>

          <MemoActionsSheet
            memo={actionsOpen ? memo : null}
            onClose={() => setActionsOpen(false)}
            onEdit={() => {
              setActionsOpen(false);
              openEditor();
            }}
            onDelete={confirmDelete}
          />
        </>
      )}
    </View>
  );
}

/**
 * The first photo runs the full width; the rest pair up under it.
 *
 * Stripes rather than the real files: `GET /media/:id` wants a bearer token,
 * which an `<Image src>` cannot send. Showing them needs a fetch-and-cache
 * step this screen does not have yet.
 */
function PhotoGrid({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <View style={{ gap: PHOTO_GAP }}>
      <PhotoPlaceholder style={{ height: 168, borderRadius: radius.xl }} />

      {count > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: PHOTO_GAP }}>
          {Array.from({ length: count - 1 }, (_, index) => (
            <PhotoPlaceholder
              key={index}
              style={{ flexBasis: '48%', flexGrow: 1, height: 110, borderRadius: radius.xl }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
