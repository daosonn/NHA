import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ellipsis, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton } from '../../src/components/layout/header-slots';
import { MemoActionsSheet } from '../../src/components/member/memo-actions-sheet';
import { CATEGORY_KEY } from '../../src/components/member/memo-card';
import { MemoDeleteDialog } from '../../src/components/member/memo-delete-dialog';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Chip } from '../../src/components/ui/chip';
import { EmptyState } from '../../src/components/ui/empty-state';
import { PhotoPlaceholder } from '../../src/components/ui/photo-placeholder';
import { Text } from '../../src/components/ui/text';
import { TextLink } from '../../src/components/ui/text-link';
import { deleteMemo, useMemoItem } from '../../src/features/member/memo-store';
import { relativeTime } from '../../src/lib/date';
import { colors, elevation, radius, spacing } from '../../src/theme';

/** Room for the floating action bar. */
const BOTTOM_INSET = 120;

const PHOTO_GAP = 8;

/**
 * One note, opened from the Memo tab.
 *
 * A note is a private thing the reader wrote themselves, so the screen is a
 * page rather than a card: full-width text, no author, nothing between the
 * words and the photos that go with them.
 */
export default function MemoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId: string }>();

  const memo = useMemoItem(memberId, id);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const openEditor = () => {
    router.push({ pathname: '/memo/edit', params: { id, memberId } });
  };

  const confirmDelete = () => {
    setConfirming(false);
    // Leave first, delete second: the note is gone the moment the store
    // publishes, and this screen would flash its empty state on the way out.
    // Undo is offered back on the profile, next to the space the note left.
    router.back();
    deleteMemo(memberId, id);
  };

  const written = memo === null ? null : relativeTime(memo.createdAt);
  const edited = memo === null ? null : relativeTime(memo.updatedAt);
  const wasEdited = memo !== null && memo.updatedAt !== memo.createdAt;

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BrandMark size={22} />
            <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
              {t('member.memoDetail.title')}
            </Text>
          </View>
        }
        right={
          memo === null ? undefined : (
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

      {memo === null ? (
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
              paddingHorizontal: spacing.xl,
              paddingTop: 18,
              paddingBottom: BOTTOM_INSET,
              gap: 14,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignSelf: 'flex-start' }}>
              <Chip label={t(CATEGORY_KEY[memo.category])} theme={memo.category} showDot />
            </View>

            <View style={{ gap: 6 }}>
              <Text
                weight="bold"
                accessibilityRole="header"
                style={{ fontSize: 25, lineHeight: 32, letterSpacing: -0.5 }}
              >
                {memo.title}
              </Text>

              {written !== null && (
                <Text variant="caption" color={colors.text.subtle}>
                  {wasEdited && edited !== null
                    ? t('member.memoDetail.metaEdited', {
                        written: t(written.key, { count: written.count }),
                        edited: t(edited.key, { count: edited.count }),
                      })
                    : t(written.key, { count: written.count })}
                </Text>
              )}
            </View>

            {memo.body !== null &&
              memo.body
                .split('\n\n')
                .filter((paragraph) => paragraph.trim() !== '')
                .map((paragraph, index) => (
                  <Text
                    key={index}
                    color={colors.text.body}
                    style={{ fontSize: 15, lineHeight: 25 }}
                  >
                    {paragraph}
                  </Text>
                ))}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginTop: 2,
              }}
            >
              <Text variant="body2" weight="semibold" color={colors.text.secondary}>
                {t('member.memoDetail.photos', { count: memo.photos.length })}
              </Text>
              <TextLink label={t('member.memoDetail.addPhoto')} onPress={openEditor} />
            </View>

            {memo.photos.length > 0 && <PhotoGrid photos={memo.photos} />}
          </ScrollView>

          {/* Only the edit action is drawn. The mockup's bare image and link
              icons have nothing behind them, and a dead control costs more
              trust than a visibly missing one. */}
          <View
            style={{
              position: 'absolute',
              right: spacing.xl,
              bottom: 34,
            }}
          >
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
          </View>

          <MemoActionsSheet
            memo={actionsOpen ? memo : null}
            onClose={() => setActionsOpen(false)}
            onEdit={() => {
              setActionsOpen(false);
              openEditor();
            }}
            onDelete={() => {
              setActionsOpen(false);
              setConfirming(true);
            }}
          />

          <MemoDeleteDialog
            visible={confirming}
            photoCount={memo.photos.length}
            onConfirm={confirmDelete}
            onCancel={() => setConfirming(false)}
          />
        </>
      )}
    </View>
  );
}

/** The first photo runs the full width; the rest pair up under it. */
function PhotoGrid({ photos }: { photos: { id: string; tone: 'light' | 'dark' }[] }) {
  const [lead, ...rest] = photos;
  if (lead === undefined) return null;

  return (
    <View style={{ gap: PHOTO_GAP }}>
      <PhotoPlaceholder tone={lead.tone} style={{ height: 168, borderRadius: radius.xl }} />

      {rest.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: PHOTO_GAP }}>
          {rest.map((photo) => (
            <PhotoPlaceholder
              key={photo.id}
              tone={photo.tone}
              style={{ flexBasis: '48%', flexGrow: 1, height: 110, borderRadius: radius.xl }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
