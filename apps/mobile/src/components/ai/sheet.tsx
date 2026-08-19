import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { colors, radius, spacing } from '../../theme';
import { Text } from '../ui/text';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
};

/**
 * The bottom sheet of screen 11d: grab handle, title with a round close
 * button, content below. Shared by the source sheet and the pickers.
 */
export function Sheet({ visible, onClose, title, subtitle, children }: SheetProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={title}
        style={{ flex: 1, backgroundColor: colors.state.scrim }}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: colors.background.card,
          borderTopLeftRadius: radius['4xl'],
          borderTopRightRadius: radius['4xl'],
          paddingTop: 8,
          paddingBottom: 30,
          maxHeight: '82%',
        }}
      >
        {/* grab handle */}
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.state.borderNeutral,
            marginBottom: 10,
          }}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingHorizontal: spacing.xl,
            gap: 10,
            marginBottom: 6,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
              {title}
            </Text>
            {!!subtitle && (
              <Text variant="caption" color={colors.text.muted}>
                {subtitle}
              </Text>
            )}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.background.subtle : colors.background.muted,
            })}
          >
            <X size={16} color={colors.text.secondary} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: 6, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}
