import { X } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '../../theme';
import { BrandMark } from '../ui/brand-mark';
import { Text } from '../ui/text';
import { AppHeader } from './app-header';
import { BackButton } from './header-slots';

export type FormScreenProps = {
  /** Shown as the back arrow. Omit for the first screen of a flow. */
  onBack?: () => void;
  /**
   * Shown as a close cross instead of the back arrow. For a form that is a
   * detour rather than a step — leaving it abandons the thing being made.
   */
  onClose?: () => void;
  /** Brand mark plus this title in the header. Omit for a bare header. */
  title?: string;
  children: React.ReactNode;
  /** Pinned under the content and above the keyboard — never scrolled away. */
  footer?: React.ReactNode;
};

/**
 * The shape every form in the app takes.
 *
 * The action stays pinned while the fields scroll: on a phone the submit
 * button disappearing behind the keyboard is the single most common way a
 * form goes wrong, and it is the one thing a shared layout can prevent for
 * every screen at once.
 */
export function FormScreen({ onBack, onClose, title, children, footer }: FormScreenProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={
          onClose !== undefined ? (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.full,
              }}
            >
              <X size={20} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
          ) : onBack !== undefined ? (
            <BackButton onPress={onBack} />
          ) : undefined
        }
        center={
          title === undefined ? undefined : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BrandMark size={22} />
              <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
                {title}
              </Text>
            </View>
          )
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xl,
            gap: 22,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {footer !== undefined && (
          <View style={{ paddingHorizontal: spacing.xl, paddingBottom: 36, gap: 12 }}>
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
