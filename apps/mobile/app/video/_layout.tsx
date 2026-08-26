import { Stack } from 'expo-router';

import { VideoDraftProvider } from '../../src/features/video/draft';
import { screenTransition } from '../../src/theme/motion';

/**
 * Luồng Memory video (màn 27-33): Setup → Photos → Music → Style → Story & scenes →
 * Making/Done. Bản nháp sống trong VideoDraftProvider suốt luồng — rời hẳn luồng là mất,
 * còn job đã tạo thì bền trong DB ("Your videos").
 */
export default function VideoLayout() {
  return (
    <VideoDraftProvider>
      {/* Stack lồng không thừa hưởng screenOptions của root — spread lại,
          không thì luồng video là chỗ duy nhất mất chuyển màn của spec. */}
      <Stack screenOptions={{ headerShown: false, ...screenTransition }} />
    </VideoDraftProvider>
  );
}
