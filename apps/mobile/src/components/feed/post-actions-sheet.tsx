import { Pencil, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';

import type { PostDetail } from '../../lib/api';
import { colors, elevation, radius } from '../../theme';
import { Button } from '../ui/button';
import { Text } from '../ui/text';

export type PostActionsSheetProps = {
  /** Bài đang được thao tác. `null` đóng sheet. */
  post: PostDetail | null;
  onClose: () => void;
  onEdit: (post: PostDetail) => void;
  onDelete: (post: PostDetail) => void;
};

/**
 * Sửa/xóa một bài đăng — bản sao có chủ đích của `member/memo-actions-sheet`:
 * cùng một Modal trơn, cùng bài học "xác nhận xóa NGAY TRONG sheet" (mở Modal
 * thứ hai cùng tick là hai tấm chồng lên nhau).
 *
 * Chỉ hiện cho tác giả (`post.canEdit`/`canDelete` server trả sẵn). Xóa là
 * thật: DELETE mang theo cả file ảnh/clip của bài, nên câu xác nhận nói rõ
 * mấy tấm sẽ đi cùng.
 */
export function PostActionsSheet({ post, onClose, onEdit, onDelete }: PostActionsSheetProps) {
  const { t } = useTranslation();

  const [confirming, setConfirming] = useState(false);

  // Sheet sống qua nhiều lần mở — bài thứ hai không được mở ra đã ở bước
  // "xóa nhé?" của bài trước.
  useEffect(() => {
    if (post === null) setConfirming(false);
  }, [post]);

  return (
    <Modal
      visible={post !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('post.actions.closeScrim')}
        style={{ flex: 1, backgroundColor: colors.state.scrim }}
      />

      {post !== null && (
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

          <View style={{ gap: 2 }}>
            <Text variant="body1" weight="semibold" numberOfLines={1}>
              {post.eventTitle ?? post.content ?? t('post.title')}
            </Text>
            <Text variant="badge" color={colors.text.subtle}>
              {t('post.actions.meta', { count: post.media.length })}
            </Text>
          </View>

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
                {t('post.deleteConfirm.title')}
              </Text>

              {/* Nói rõ cái gì đi theo: DELETE của bài lấy luôn file media. */}
              <Text variant="body2" color={colors.text.muted} style={{ textAlign: 'center' }}>
                {t('post.deleteConfirm.body', { count: post.media.length })}
              </Text>

              <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>
                <Button
                  label={t('post.deleteConfirm.confirm')}
                  variant="destructiveSolid"
                  size="large"
                  fullWidth
                  onPress={() => onDelete(post)}
                />
                <Button
                  label={t('post.deleteConfirm.cancel')}
                  variant="neutral"
                  size="large"
                  fullWidth
                  onPress={() => setConfirming(false)}
                />
              </View>
            </View>
          ) : (
            <>
              {post.canEdit && (
                <View
                  style={{
                    borderRadius: radius['2xl'],
                    backgroundColor: colors.background.card,
                    boxShadow: `inset 0 0 0 1px rgba(24,24,27,0.06)`,
                  }}
                >
                  <Pressable
                    onPress={() => onEdit(post)}
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
                      {t('post.actions.edit')}
                    </Text>
                  </Pressable>
                </View>
              )}

              {post.canDelete && (
                <Pressable
                  onPress={() => setConfirming(true)}
                  accessibilityRole="button"
                  style={{
                    height: 54,
                    paddingHorizontal: 16,
                    borderRadius: radius['2xl'],
                    backgroundColor: colors.background.card,
                    boxShadow: `inset 0 0 0 1px rgba(240,112,95,0.28)`,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Trash2 size={20} color={colors.coral.deep} strokeWidth={2} />
                  <Text
                    variant="body1"
                    weight="semibold"
                    color={colors.coral.deep}
                    style={{ flex: 1 }}
                  >
                    {t('post.actions.delete')}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={{
                  height: 52,
                  borderRadius: radius.full,
                  backgroundColor: colors.background.subtle,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="body1" weight="semibold" color={colors.text.secondary}>
                  {t('post.actions.cancel')}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </Modal>
  );
}
