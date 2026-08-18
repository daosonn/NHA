import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors } from '../../theme';
import { Text } from '../ui/text';
import { AppHeader } from './app-header';
import { BackButton } from './header-slots';

export type PlaceholderScreenProps = {
  title: string;
  /** Required on pushed screens — without it there is no way back out. */
  onBack?: () => void;
};

/**
 * A named, navigable stub so the shell can be reviewed before the screens
 * behind it exist. Delete each usage as its screen is built.
 */
export function PlaceholderScreen({ title, onBack }: PlaceholderScreenProps) {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.page }}>
      <AppHeader
        left={onBack !== undefined ? <BackButton onPress={onBack} /> : undefined}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {title}
          </Text>
        }
      />
      <View className="flex-1 items-center justify-center gap-sm bg-page p-xl">
        <Text variant="body1" weight="semibold" color={colors.text.muted}>
          {title}
        </Text>
        <Text variant="body2" color={colors.text.lightMuted}>
          {t('common.notBuiltYet')}
        </Text>
      </View>
    </View>
  );
}
