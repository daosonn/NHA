import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { Trash2, X } from 'lucide-react-native';

import { ApiError } from '../../lib/api';
import { colors, elevation, radius } from '../../theme';
import { Button } from '../ui/button';
import { SheetModal } from '../ui/sheet-modal';
import { Text } from '../ui/text';
import { TextField } from '../ui/text-field';

const MAX_NAME = 100;
const MAX_DESCRIPTION = 2000;

export type AlbumFormValues = {
  name: string;
  description?: string;
};

export type AlbumFormSheetProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  /** Seeds the fields when editing. */
  initial?: { name: string; description: string | null };
  saving?: boolean;
  error?: unknown;
  onClose: () => void;
  onSubmit: (values: AlbumFormValues) => void;
  /** Edit mode only. Omitted, no delete affordance is drawn. */
  onDelete?: () => void;
};

/**
 * Naming an album, and renaming one.
 *
 * One sheet for both: to the person typing, calling a shelf something and
 * calling it something else are the same act, and a second component would
 * be a second set of length limits to keep in step with the DTO.
 *
 * The description is optional and stays optional — an album with a name is a
 * complete thought, and demanding a paragraph before the first photograph
 * goes in is how shelves end up not being made.
 */
export function AlbumFormSheet({
  visible,
  mode,
  initial,
  saving = false,
  error,
  onClose,
  onSubmit,
  onDelete,
}: AlbumFormSheetProps) {
  const { t } = useTranslation();

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  /** Two taps to delete, and the second one says what actually happens. */
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The sheet outlives its contents: it stays mounted while closed, so the
  // fields have to be re-seeded each time it opens or the second edit shows
  // the first one's text.
  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setConfirmingDelete(false);
  }, [visible, initial?.name, initial?.description]);

  const ready = name.trim() !== '';

  const errorKey =
    error === null || error === undefined
      ? null
      : error instanceof ApiError && error.isOffline
        ? 'errors.offline'
        : 'errors.generic';

  return (
    <SheetModal visible={visible} onClose={onClose} scrimLabel={t('common.close')}>
      <View
        style={[
          {
            borderTopLeftRadius: radius['7xl'],
            borderTopRightRadius: radius['7xl'],
            backgroundColor: colors.background.page,
            paddingTop: 10,
          },
          elevation.sheet,
        ]}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 44,
            height: 5,
            borderRadius: radius.full,
            backgroundColor: '#E2DCD7',
          }}
        />

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 34, gap: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Text variant="h2" weight="bold" style={{ flex: 1, letterSpacing: -0.3 }}>
              {mode === 'create' ? t('albums.form.createTitle') : t('albums.form.editTitle')}
            </Text>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.full,
                backgroundColor: colors.background.subtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={17} color={colors.text.secondary} strokeWidth={2} />
            </Pressable>
          </View>

          <TextField
            label={t('albums.form.nameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('albums.form.namePlaceholder')}
            maxLength={MAX_NAME}
            autoFocus={mode === 'create'}
          />

          <TextField
            label={t('albums.form.descriptionLabel')}
            value={description}
            onChangeText={setDescription}
            placeholder={t('albums.form.descriptionPlaceholder')}
            maxLength={MAX_DESCRIPTION}
            multiline
            numberOfLines={4}
          />

          {errorKey !== null && (
            <Text
              variant="caption"
              color={colors.themes.destructive.text}
              accessibilityRole="alert"
            >
              {t(errorKey)}
            </Text>
          )}

          <Button
            label={mode === 'create' ? t('albums.form.create') : t('albums.form.save')}
            size="large"
            fullWidth
            disabled={!ready}
            loading={saving}
            onPress={() => {
              const trimmed = description.trim();
              onSubmit({
                name: name.trim(),
                // '' would be a description of nothing; the field is optional
                // on the DTO and omitting it is what leaves it unset.
                description: trimmed === '' ? undefined : trimmed,
              });
            }}
          />

          {mode === 'edit' && onDelete !== undefined && (
            <View style={{ gap: 8, paddingTop: 4 }}>
              {/* No separate dialog. Deleting an album throws away the shelf
                  and nothing else — the photographs stay in the moments they
                  came from — so the weight of a full-screen confirmation
                  would overstate what is happening. The second tap and the
                  line above it carry it. */}
              {confirmingDelete && (
                <Text variant="caption" color={colors.text.muted}>
                  {t('albums.form.deleteExplain')}
                </Text>
              )}

              <Button
                label={confirmingDelete ? t('albums.form.deleteConfirm') : t('albums.form.delete')}
                variant={confirmingDelete ? 'destructiveSolid' : 'destructive'}
                size="large"
                fullWidth
                onPress={() => (confirmingDelete ? onDelete() : setConfirmingDelete(true))}
                renderIcon={({ size, color }) => (
                  <Trash2 size={size} color={color} strokeWidth={2.1} />
                )}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </SheetModal>
  );
}
