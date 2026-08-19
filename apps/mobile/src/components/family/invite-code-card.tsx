import * as Clipboard from 'expo-clipboard';
import { Copy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors, radius } from '../../theme';
import { Button } from '../ui/button';
import { Text } from '../ui/text';

/** How long the Copy button stays in its confirmed state. */
const COPIED_MS = 2000;

/**
 * Splits the 8-character code down the middle: `K7M2QRXP` → `K7M2 QRXP`.
 *
 * Two groups of four is what makes a code survive being read down a phone
 * line. The alphabet already drops I, O, 0 and 1 for the same reason
 * (`src/fixtures/invite.ts`).
 */
function grouped(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`.trim();
}

export type InviteCodeCardProps = {
  /** `Family.inviteCode`, unspaced — exactly what the server stores. */
  code: string;
  /** The line under it: which family, and that it does not expire. */
  subtitle: string;
};

/**
 * The family's invite code, the thing the receiver actually types.
 *
 * Not a link: `Family.inviteCode` is what the server has, and the web page a
 * link would need does not exist yet — the role of `apps/web` is still
 * undecided (`docs/01-frontend/architecture.md`). A code also works when it is
 * read aloud to someone who does not have the app yet, which is most of the
 * people this screen is for.
 *
 * Shared by the invite sheet on the tree and by the screen that creates a
 * group, because both hand out the same eight characters.
 */
export function InviteCodeCard({ code, subtitle }: InviteCodeCardProps) {
  const { t } = useTranslation();

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    // The raw code, not the spaced one — the spacing is for eyes only, and a
    // pasted space is a rejected code.
    await Clipboard.setStringAsync(code);
    setCopied(true);
  };

  return (
    <View
      style={{
        borderRadius: radius.xl,
        backgroundColor: colors.coral.light,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        {/* No monospace face is bundled, so the code is spaced out by hand —
            letter spacing is what makes a code scannable, not the family. */}
        <Text
          weight="bold"
          numberOfLines={1}
          accessibilityLabel={t('invite.sheet.codeLabel', { code: code.split('').join(' ') })}
          style={{ fontSize: 22, lineHeight: 26, letterSpacing: 3 }}
        >
          {grouped(code)}
        </Text>
        <Text variant="badge" color={colors.text.subtle}>
          {subtitle}
        </Text>
      </View>

      <Button
        label={copied ? t('invite.sheet.copied') : t('invite.sheet.copy')}
        variant="secondary"
        size="small"
        onPress={() => void copy()}
        renderIcon={({ size, color }) => <Copy size={size} color={color} strokeWidth={2.1} />}
      />
    </View>
  );
}
