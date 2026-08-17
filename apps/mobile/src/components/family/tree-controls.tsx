import { Crosshair, Minus, Plus, UserRoundPlus } from 'lucide-react-native';
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
      <ControlButton label="Zoom in" disabled={!canZoomIn} onPress={onZoomIn}>
        <Plus size={19} color={colors.text.secondary} strokeWidth={2} />
      </ControlButton>

      <View style={{ width: 20, height: 1, backgroundColor: '#EFEBE7' }} />

      <ControlButton label="Zoom out" disabled={!canZoomOut} onPress={onZoomOut}>
        <Minus size={19} color={colors.text.secondary} strokeWidth={2} />
      </ControlButton>

      <View style={{ width: 20, height: 1, backgroundColor: '#EFEBE7' }} />

      <ControlButton label="Recenter" disabled={false} onPress={onRecenter}>
        <Crosshair size={18} color={colors.text.secondary} strokeWidth={2} />
      </ControlButton>
    </View>
  );
}

/** Quiet instruction pill, bottom left of the canvas. */
export function CanvasHint({ children }: { children: string }) {
  return (
    <View
      className="absolute bottom-lg left-lg h-[28px] justify-center px-[11px]"
      style={{ borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.86)' }}
      pointerEvents="none"
    >
      <Text variant="badge" weight="medium" color={colors.text.muted}>
        {children}
      </Text>
    </View>
  );
}

/** Add-a-member action, bottom right of the canvas. */
export function AddMemberButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add a family member"
      className="absolute bottom-lg right-lg h-[52px] w-[52px] items-center justify-center bg-coral"
      style={{ borderRadius: radius.full }}
    >
      <UserRoundPlus size={23} color={colors.text.white} strokeWidth={2.1} />
    </Pressable>
  );
}
