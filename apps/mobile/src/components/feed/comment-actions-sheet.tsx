import { Pencil, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { CommentSummary } from '../../lib/api';
import { colors, elevation, radius } from '../../theme';
import { Button } from '../ui/button';
import { SheetModal } from '../ui/sheet-modal';
import { Text } from '../ui/text';

export type CommentActionsSheetProps = {
  /** The comment being acted on. `null` closes the sheet. */
  comment: CommentSummary | null;
  onClose: () => void;
  onEdit: (comment: CommentSummary) => void;
  onDelete: (comment: CommentSummary) => void;
  deleting?: boolean;
};

/**
 * Edit or delete your own comment.
 *
 * Built to the same shape as `components/member/memo-actions-sheet.tsx`,
 * including **confirming the delete inside this sheet rather than in a
 * second modal** — dismissing one `Modal` and presenting another on the same
 * tick made the two overlap on screen, which is a bug this app has already
 * shipped once.
 *
 * The server only lets an author touch their own comment, and the row only
 * draws the ⋯ on those, so nothing here is guarding permissions — that is
 * the server's job (`CLAUDE.md` § 3). It is deciding what to draw.
 *
 * There is no "hide" or "report": the post's author has no moderation power
 * on the server today, so a row offering it would be a button that cannot
 * work. Noted for the backend owner in `project-status.md`.
 */
export function CommentActionsSheet({
  comment,
  onClose,
  onEdit,
  onDelete,
  deleting = false,
}: CommentActionsSheetProps) {
  const { t } = useTranslation();

  const [confirming, setConfirming] = useState(false);

  // The sheet stays mounted between openings, so the second comment must not
  // arrive already asking whether to delete the first.
  useEffect(() => {
    if (comment === null) setConfirming(false);
  }, [comment]);

  return (
    <SheetModal
      visible={comment !== null}
      onClose={onClose}
      scrimLabel={t('post.commentActions.closeScrim')}
    >
      {comment !== null && (
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

          {/* The comment itself, so there is no doubt which one this is
              about — a thread can hold several of yours that start alike. */}
          <Text variant="body2" color={colors.text.muted} numberOfLines={2}>
            {comment.content}
          </Text>

          {confirming ? (
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
                {t('post.commentDelete.title')}
              </Text>

              <Text variant="body2" color={colors.text.muted} style={{ textAlign: 'center' }}>
                {t('post.commentDelete.body')}
              </Text>

              <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>
                <Button
                  label={t('post.commentDelete.confirm')}
                  variant="destructiveSolid"
                  size="large"
                  fullWidth
                  loading={deleting}
                  onPress={() => onDelete(comment)}
                />
                <Button
                  label={t('post.commentDelete.cancel')}
                  variant="neutral"
                  size="large"
                  fullWidth
                  onPress={() => setConfirming(false)}
                />
              </View>
            </View>
          ) : (
            <>
              <View
                style={{
                  borderRadius: radius['2xl'],
                  backgroundColor: colors.background.card,
                  boxShadow: 'inset 0 0 0 1px rgba(24,24,27,0.06)',
                }}
              >
                <Pressable
                  onPress={() => onEdit(comment)}
                  accessibilityRole="button"
                  style={{
                    height: 54,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Pencil size={20} color={colors.text.secondary} strokeWidth={2} />
                  <Text variant="body1" weight="medium" style={{ flex: 1 }}>
                    {t('post.commentActions.edit')}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setConfirming(true)}
                accessibilityRole="button"
                style={{
                  height: 54,
                  paddingHorizontal: 16,
                  borderRadius: radius['2xl'],
                  backgroundColor: colors.themes.destructive.bg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Trash2 size={20} color={colors.themes.destructive.text} strokeWidth={2} />
                <Text
                  variant="body1"
                  weight="medium"
                  color={colors.themes.destructive.text}
                  style={{ flex: 1 }}
                >
                  {t('post.commentActions.delete')}
                </Text>
              </Pressable>

              <Button
                label={t('post.commentActions.cancel')}
                variant="neutral"
                size="large"
                fullWidth
                onPress={onClose}
              />
            </>
          )}
        </View>
      )}
    </SheetModal>
  );
}
