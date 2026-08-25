import { useTranslation } from 'react-i18next';

import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Text } from '../ui/text';
import { colors } from '../../theme';

export type InlineErrorProps = {
  /** A finished, translated sentence — the caller holds `t`. */
  message: string;
  onRetry?: () => void;
  /** Overrides the default `common.retry` label. */
  retryLabel?: string;
};

/**
 * A failed request, said out loud, next to the thing that failed.
 *
 * The AI screens' mutations have no global error handler (`query-client.ts`
 * keeps `retry: false` and stays silent on purpose), so every screen must
 * render its own failure — and several forgot, which is how "tap → spinner →
 * nothing" became the most reported dead end in the audit. This is the one
 * shape to reach for: the same white card + retry that `gift-results` shipped
 * first, extracted so no screen has to re-invent (or forget) it.
 */
export function InlineError({ message, onRetry, retryLabel }: InlineErrorProps) {
  const { t } = useTranslation();

  return (
    <Card padding={16} style={{ gap: 10 }} accessibilityLiveRegion="polite">
      <Text variant="body2" color={colors.text.body}>
        {message}
      </Text>
      {onRetry !== undefined && (
        <Button
          label={retryLabel ?? t('common.retry')}
          variant="secondary"
          size="small"
          onPress={onRetry}
        />
      )}
    </Card>
  );
}
