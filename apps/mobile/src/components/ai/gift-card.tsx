import { BookmarkCheck, BookmarkPlus, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { GiftIdea } from '../../fixtures/ai';
import { colors, radius } from '../../theme';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Chip } from '../ui/chip';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

export type GiftCardProps = {
  idea: GiftIdea;
  saved: boolean;
  onToggleSave: () => void;
};

/**
 * One suggestion, with its evidence attached.
 *
 * The `why` block and the source line are not garnish: they are the only
 * way the reader can tell a good guess from a real observation someone in
 * the family wrote down. A suggestion that cannot show its working does not
 * belong on this screen.
 */
export function GiftCard({ idea, saved, onToggleSave }: GiftCardProps) {
  const { t } = useTranslation();

  return (
    <Card padding={14} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <PhotoPlaceholder
          style={{ width: 88, height: 88, flexShrink: 0, borderRadius: radius.lg }}
        />

        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Text variant="body1" weight="semibold" style={{ letterSpacing: -0.1 }}>
            {idea.title}
          </Text>

          <Text variant="body2" weight="semibold" color={colors.coral.hover}>
            {idea.price}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {idea.tags.map((tag) => (
              <Chip key={tag} label={tag} />
            ))}
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          padding: 10,
          paddingHorizontal: 12,
          borderRadius: radius.lg,
          backgroundColor: colors.coral.soft,
        }}
      >
        <Sparkles size={15} color={colors.coral.hover} strokeWidth={2.1} />

        <Text variant="caption" color={colors.text.body} style={{ flex: 1 }}>
          {idea.why}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <Text variant="badge" color={colors.text.subtle} style={{ flex: 1 }}>
          {idea.source}
        </Text>

        <Button
          label={saved ? t('ai.gifts.saved') : t('ai.gifts.save')}
          variant={saved ? 'secondary' : 'neutral'}
          size="small"
          onPress={onToggleSave}
          renderIcon={({ size, color }) =>
            saved ? (
              <BookmarkCheck size={size} color={color} strokeWidth={2.1} />
            ) : (
              <BookmarkPlus size={size} color={color} strokeWidth={2.1} />
            )
          }
        />
      </View>
    </Card>
  );
}
