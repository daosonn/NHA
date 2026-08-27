import { Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';

import type { FamilySummary } from '../../lib/api';
import { colors, elevation, radius } from '../../theme';
import { Button } from '../ui/button';
import { Text } from '../ui/text';

export type DeleteFamilySheetProps = {
  /** Nhà sắp xóa. `null` đóng sheet. */
  family: FamilySummary | null;
  onClose: () => void;
  onConfirm: (family: FamilySummary) => void;
  deleting?: boolean;
  /** Lý do server từ chối, đã đổi ra key i18n — hiện ngay dưới hai nút. */
  errorKey?: string | null;
};

/**
 * Xác nhận xóa một gia đình — cùng khuôn Modal trơn với các sheet khác
 * (memo/post). Chỉ có bước xác nhận, không có menu: nút thùng rác trên màn
 * cây đã là lời mở.
 *
 * Câu chữ nói rõ cái gì mất (cây, thành viên, lời mời) và cái gì KHÔNG mất
 * (bài đăng theo tác giả) — người ta xóa nhầm vì sợ mất ảnh nhiều hơn vì
 * sợ mất cây.
 */
export function DeleteFamilySheet({
  family,
  onClose,
  onConfirm,
  deleting = false,
  errorKey = null,
}: DeleteFamilySheetProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={family !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('family.delete.cancel')}
        style={{ flex: 1, backgroundColor: colors.state.scrim }}
      />

      {family !== null && (
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
              {t('family.delete.title', { name: family.name })}
            </Text>

            <Text variant="body2" color={colors.text.muted} style={{ textAlign: 'center' }}>
              {t('family.delete.body', { count: family.memberCount })}
            </Text>

            {errorKey !== null && (
              <Text
                variant="caption"
                color={colors.themes.destructive.text}
                accessibilityRole="alert"
                style={{ textAlign: 'center' }}
              >
                {t(errorKey)}
              </Text>
            )}

            <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>
              <Button
                label={t('family.delete.confirm')}
                variant="destructiveSolid"
                size="large"
                fullWidth
                loading={deleting}
                onPress={() => onConfirm(family)}
              />
              <Button
                label={t('family.delete.cancel')}
                variant="neutral"
                size="large"
                fullWidth
                onPress={onClose}
              />
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}
