import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { AudiencePicker } from '../../src/components/moment/audience-picker';
import { MediaStrip } from '../../src/components/moment/media-strip';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import {
  audienceGroups,
  draftCaption,
  draftMedia,
  type AudienceGroup,
  type DraftMedia,
} from '../../src/fixtures/moment';
import { colors, spacing } from '../../src/theme';

/** Clears the bottom nav (56pt plus the home indicator) with room to breathe. */
const BOTTOM_INSET = 140;

export default function NewMomentScreen() {
  const { t } = useTranslation();

  const [caption, setCaption] = useState(draftCaption);
  const [media, setMedia] = useState<DraftMedia[]>(draftMedia);
  const [selected, setSelected] = useState<string[]>(audienceGroups.map((group) => group.id));

  const toggle = (group: AudienceGroup) =>
    setSelected((current) =>
      current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id],
    );

  const excluded = audienceGroups.filter((group) => !selected.includes(group.id));

  // A count of families, worded so "1" does not read as a bug.
  const postLabel =
    selected.length === 0
      ? t('moment.postPrivately')
      : t('moment.postTo', { count: selected.length });

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('moment.title')}
          </Text>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: BOTTOM_INSET, gap: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label={t('moment.caption')}
          value={caption}
          onChangeText={setCaption}
          placeholder={t('moment.captionPlaceholder')}
          multiline
        />

        <View style={{ gap: 2 }}>
          <Text variant="body1" weight="semibold">
            {t('moment.media')}
          </Text>
          <MediaStrip
            media={media}
            onRemove={(item) => setMedia((current) => current.filter((m) => m.id !== item.id))}
          />
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ gap: 2 }}>
            <Text variant="body1" weight="semibold">
              {t('moment.shareWith')}
            </Text>
            <Text variant="body2" color={colors.text.body}>
              {t('moment.shareWithHint')}
            </Text>
          </View>

          <AudiencePicker groups={audienceGroups} selected={selected} onToggle={toggle} />
        </View>

        <View style={{ gap: 10 }}>
          <Button
            label={postLabel}
            size="large"
            fullWidth
            renderIcon={({ size, color }) => <Send size={size} color={color} strokeWidth={2.1} />}
          />

          {/* Saying who is excluded is the whole point of the dimmed state —
              a count alone would not tell you *which* family you dropped. */}
          <Text variant="caption" color={colors.text.subtle} style={{ textAlign: 'center' }}>
            {selected.length === 0
              ? t('moment.explainPrivate')
              : excluded.length === 0
                ? t('moment.explainEveryone')
                : t('moment.explainSkipped', {
                    count: excluded.length,
                    names: excluded.map((group) => group.name).join(', '),
                  })}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
