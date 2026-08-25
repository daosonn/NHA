import { X } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, useLayout } from '../../theme';
import { AppHeader } from './app-header';
import { AuthShell } from './auth-shell';
import { ContentColumn, contentColumn } from './content-column';
import { BackButton, ScreenTitle } from './header-slots';

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
  /**
   * `auth` moves the form into the two-pane brand card on wide windows — see
   * `auth-shell.tsx`. Only for signing in and out: the same shell around
   * "New family" or "Change password" would put a marketing headline next to a
   * form somebody already inside the app opened on purpose.
   *
   * Below `lg` it changes nothing at all, on either variant.
   */
  variant?: 'plain' | 'auth';
};

/**
 * The shape every form in the app takes.
 *
 * The action stays pinned while the fields scroll: on a phone the submit
 * button disappearing behind the keyboard is the single most common way a
 * form goes wrong, and it is the one thing a shared layout can prevent for
 * every screen at once.
 */
export function FormScreen({
  onBack,
  onClose,
  title,
  children,
  footer,
  variant = 'plain',
}: FormScreenProps) {
  const { t } = useTranslation();
  const { expanded } = useLayout();

  const lead =
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
    ) : undefined;

  // The header goes with it: a full-width bar carrying one back arrow, above a
  // card floating in the middle of the window, belongs to neither of them.
  if (variant === 'auth' && expanded) {
    return (
      <View className="flex-1 bg-page">
        <AuthShell lead={lead} footer={footer}>
          {children}
        </AuthShell>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={lead}
        center={title === undefined ? undefined : <ScreenTitle title={title} />}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            ...contentColumn,
            paddingBottom: spacing.xl,
            gap: 22,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {footer !== undefined && (
          <ContentColumn style={{ paddingBottom: 36, gap: 12 }}>{footer}</ContentColumn>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
