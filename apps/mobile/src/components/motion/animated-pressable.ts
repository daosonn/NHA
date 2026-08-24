import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * One `Pressable` the whole app animates with. `createAnimatedComponent`
 * builds a new component class per call, so doing it inside a render — or
 * once per file — makes React remount the subtree on every render or ship
 * several identical classes. One module, one class.
 */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
