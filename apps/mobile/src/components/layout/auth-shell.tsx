import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { welcomeFaces } from '../../fixtures/welcome-faces';
import { colors, spacing } from '../../theme';
import { CatHappy } from '../motion/cats';
import { AvatarStack } from '../ui/avatar-stack';
import { BrandMark } from '../ui/brand-mark';
import { Text } from '../ui/text';

/**
 * Readable width for the contents of a half-window pane.
 *
 * Each pane is half the window — 960px on a 1920 screen — and neither a
 * headline nor a sign-in form should be 960 wide. So the panes are full-bleed
 * and their *contents* are not.
 */
const PANE_CONTENT = 420;
const PANE_PADDING = 40;

/**
 * The left half: what the app is, said once.
 *
 * The same mark, headline, subtitle and faces the Welcome screen shows on a
 * phone — moved here rather than copied, so signing in on a wide window is met
 * by the same sentence as arriving is. The faces come from
 * `fixtures/welcome-faces` for the same reason: the two screens each held
 * their own copy of that list, which is two places for one row of people to
 * drift apart.
 *
 * The cat is from the motion kit, and using it here is a deliberate reading of
 * that kit's rule rather than an oversight. `motion/README.md` reserves the
 * cats for "one-time emotional moments… never in chrome, never on daily
 * actions": this pane is neither chrome nor a daily action — it is the app
 * introducing itself, on the one screen whose whole job is that. `CatHappy` of
 * the four, because the pane is a welcome and not a wait.
 */
function BrandPane() {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.coral.light,
        paddingHorizontal: PANE_PADDING,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: '100%', maxWidth: PANE_CONTENT, alignItems: 'center', gap: 22 }}>
        <BrandMark size={52} />

        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text
            serif
            weight="bold"
            accessibilityRole="header"
            style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.4, textAlign: 'center' }}
          >
            {t('auth.welcome.title')}
          </Text>

          <Text variant="body1" color={colors.text.muted} style={{ textAlign: 'center' }}>
            {t('auth.welcome.subtitle')}
          </Text>
        </View>

        {/* Directly above the faces, so the cat reads as being *with* the
            family rather than as a second, unrelated illustration. */}
        <CatHappy size={104} />

        <AvatarStack items={welcomeFaces} size={32} surface={colors.coral.light} remaining={6} />
      </View>
    </View>
  );
}

export type AuthShellProps = {
  /** Back or close, at the top of the form pane. Omit on the first screen. */
  lead?: React.ReactNode;
  /** The form. Scrolls inside its pane if the window is short. */
  children: React.ReactNode;
  /**
   * Submit and the social buttons.
   *
   * Rendered as the tail of the same centred group, **not** pinned to the
   * bottom of the pane. `FormScreen` pins it on a phone for one reason — the
   * software keyboard, which will cover a submit button that scrolls. A
   * physical keyboard covers nothing, and pinning it here would leave 400px of
   * white between the last field and the button that submits it.
   */
  footer?: React.ReactNode;
};

/**
 * Signing in, on a window wide enough to stop pretending to be a phone.
 *
 * A phone auth screen is a full-height column: hero at the top, actions under
 * it, the slack pushed to the bottom. Stretched to 1280 that leaves a coral
 * band the width of the window with a 58px mark alone in the middle of it, and
 * a form pinned to the top of an otherwise empty page.
 *
 * So from `lg` up it becomes **two halves of the window**: the brand on the
 * left, the form on the right, both full height, split down the middle. This
 * was a centred 960px card first, on 2026-08-25, and that was wrong in a way
 * worth recording — a card floating in the middle of a 1920px window is a
 * dialog, and a sign-in screen is not a dialog interrupting something. It is
 * the page. Filling the window is what every web sign-in does, and what makes
 * it read as one.
 *
 * The panes are full-bleed; their **contents are not**. Half of 1920 is 960,
 * and neither a headline nor a form belongs at that width, so each pane centres
 * a 420px column inside itself. That is the same reasoning as the content
 * column elsewhere in the app, at the width a form wants rather than the width
 * a feed wants.
 *
 * No divider between them: `coral.light` against white is already an edge, and
 * a hairline on top of a colour change is a line for its own sake.
 *
 * **Below `lg` none of this renders.** Welcome keeps its edge-to-edge coral
 * hero and `FormScreen` keeps its column — the caller decides. That also means
 * the 2026-08-21 revert of a centred, shrunken Welcome card stands untouched:
 * this is a different layout for a different window, not a second attempt at
 * that one.
 */
export function AuthShell({ lead, children, footer }: AuthShellProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <BrandPane />

      <View style={{ flex: 1, backgroundColor: colors.background.card }}>
        {/* Absolute, so a back arrow does not pull the form off centre. */}
        {lead !== undefined && (
          <View
            style={{
              position: 'absolute',
              top: insets.top + spacing.lg,
              left: spacing.lg,
              zIndex: 1,
            }}
          >
            {lead}
          </View>
        )}

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: PANE_PADDING,
            paddingTop: insets.top + PANE_PADDING,
            paddingBottom: insets.bottom + PANE_PADDING,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: PANE_CONTENT, gap: 20 }}>
            {children}

            {footer !== undefined && <View style={{ gap: 12 }}>{footer}</View>}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
