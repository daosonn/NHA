import { Check, Crosshair, Minus, Pencil, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors, elevation, radius } from '../../theme';
import { Text } from '../ui/text';

export type ZoomControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
};

function ControlButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className="h-[40px] w-[40px] items-center justify-center"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      {children}
    </Pressable>
  );
}

/** Zoom and recenter, floating over the canvas at the top right. */
export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onRecenter,
  canZoomIn,
  canZoomOut,
}: ZoomControlsProps) {
  const { t } = useTranslation();

  return (
    <View
      className="absolute right-md top-md items-center"
      style={[
        {
          width: 40,
          borderRadius: radius.full,
          backgroundColor: 'rgba(255,255,255,0.94)',
        },
        elevation.floating,
      ]}
    >
      <ControlButton label={t('family.zoomIn')} disabled={!canZoomIn} onPress={onZoomIn}>
        <Plus size={19} color={colors.text.secondary} strokeWidth={2} />
      </ControlButton>

      <View style={{ width: 20, height: 1, backgroundColor: '#EFEBE7' }} />

      <ControlButton label={t('family.zoomOut')} disabled={!canZoomOut} onPress={onZoomOut}>
        <Minus size={19} color={colors.text.secondary} strokeWidth={2} />
      </ControlButton>

      <View style={{ width: 20, height: 1, backgroundColor: '#EFEBE7' }} />

      <ControlButton label={t('family.recenter')} disabled={false} onPress={onRecenter}>
        <Crosshair size={18} color={colors.text.secondary} strokeWidth={2} />
      </ControlButton>
    </View>
  );
}

/** Quiet instruction pill, bottom left of the canvas. */
export function CanvasHint({ children }: { children: string }) {
  return (
    <View
      className="absolute bottom-lg left-lg justify-center px-[11px] py-[6px]"
      // Bounded on the right so a long hint on a 320px screen wraps instead
      // of running on underneath the add-member button; the fixed 28px
      // height went with it, since a wrapped hint is two lines tall.
      style={{
        borderRadius: radius.xl,
        backgroundColor: 'rgba(255,255,255,0.86)',
        maxWidth: '72%',
        alignSelf: 'flex-start',
      }}
      pointerEvents="none"
    >
      <Text variant="badge" weight="medium" color={colors.text.muted}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Edit-mode toggle, bottom right of the canvas — it replaced the plain
 * add-member button (owner's prototype `src/family-tree-canvas.html`,
 * 2026-08-28): typing a relationship was the error-prone part of adding, so
 * adding now happens by tapping the dashed slot where the person belongs,
 * and this button only opens and closes that mode. White pencil at rest,
 * coral check while editing.
 */
export function EditToggleButton({ editing, onPress }: { editing: boolean; onPress?: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={editing ? t('family.doneEditing') : t('family.editTree')}
      accessibilityState={{ selected: editing }}
      className="absolute bottom-lg right-lg h-[52px] w-[52px] items-center justify-center"
      style={[
        {
          borderRadius: radius.full,
          backgroundColor: editing ? colors.coral.primary : colors.background.card,
        },
        elevation.floating,
      ]}
    >
      {editing ? (
        <Check size={22} color={colors.text.white} strokeWidth={2.4} />
      ) : (
        <Pencil size={20} color={colors.coral.deep} strokeWidth={2.1} />
      )}
    </Pressable>
  );
}
