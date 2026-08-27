import { View } from 'react-native';

import { colors, radius } from '../../theme';
import { CatSleeping } from '../motion/cats';
import { Button } from './button';
import { Text } from './text';

export type EmptyStateProps = {
  /** Lucide icon, given the size and colour to draw at. */
  renderIcon: (props: { size: number; color: string }) => React.ReactNode;
  /**
   * Draws the kit's sleeping cat instead of the icon — nothing here yet, so
   * it went to sleep (mapping decided 2026-08-25: empty = sleeping, running
   * = eyes-down, done = happy). For genuinely empty moments only — an error
   * or a "gone" state keeps its icon: a playful cat next to "something went
   * wrong" reads as the app not taking the problem seriously.
   */
  cat?: boolean;
  title: string;
  description?: string;
  /** Drawn only alongside `onActionPress` — see below. */
  actionLabel?: string;
  onActionPress?: () => void;
  /**
   * A second, quieter way out (ghost button under the first) — for the
   * empty states that are really a fork: "create a family" or "join one".
   * Same label-and-handler rule as the primary action.
   */
  secondaryActionLabel?: string;
  onSecondaryActionPress?: () => void;
};

/**
 * Shown where content would be. States what is missing and what to do about
 * it — an empty section should never be a blank rectangle the reader has to
 * interpret.
 *
 * The action needs **both** a label and a handler. A label on its own used to
 * be enough, which is how two profiles ended up offering "Add a milestone"
 * and "Post a memory" buttons that did nothing at all: the caller wrote the
 * copy before the destination existed, and nothing here objected. Requiring
 * the pair moves "a button that leads nowhere is not rendered"
 * (`docs/project-status.md` → Important Decisions) from a rule people have to
 * remember into one the component keeps.
 */
export function EmptyState({
  renderIcon,
  cat = false,
  title,
  description,
  actionLabel,
  onActionPress,
  secondaryActionLabel,
  onSecondaryActionPress,
}: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 24 }}>
      {cat ? (
        <CatSleeping size={110} />
      ) : (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.full,
            backgroundColor: colors.background.subtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderIcon({ size: 22, color: colors.text.subtle })}
        </View>
      )}

      <View style={{ alignItems: 'center', gap: 3 }}>
        <Text variant="body1" weight="semibold" style={{ textAlign: 'center' }}>
          {title}
        </Text>

        {description !== undefined && (
          <Text variant="body2" color={colors.text.body} style={{ textAlign: 'center' }}>
            {description}
          </Text>
        )}
      </View>

      {actionLabel !== undefined && onActionPress !== undefined && (
        <Button
          label={actionLabel}
          variant="secondary"
          size="small"
          align="center"
          onPress={onActionPress}
        />
      )}

      {secondaryActionLabel !== undefined && onSecondaryActionPress !== undefined && (
        <Button
          label={secondaryActionLabel}
          variant="ghost"
          size="small"
          align="center"
          onPress={onSecondaryActionPress}
        />
      )}
    </View>
  );
}
