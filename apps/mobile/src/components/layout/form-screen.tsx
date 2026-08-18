import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { spacing } from '../../theme';
import { AppHeader } from './app-header';
import { BackButton } from './header-slots';

export type FormScreenProps = {
  /** Shown as the back arrow. Omit for the first screen of a flow. */
  onBack?: () => void;
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
export function FormScreen({ onBack, children, footer }: FormScreenProps) {
  return (
    <View className="flex-1 bg-page">
      <AppHeader left={onBack !== undefined ? <BackButton onPress={onBack} /> : undefined} />

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
