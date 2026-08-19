import { Stack } from 'expo-router';

import { VideoDraftProvider } from '../../src/features/video/draft';

/**
 * Luồng Memory video (màn 27-33): Setup → Photos → Music → Style → Story & scenes →
 * Making/Done. Bản nháp sống trong VideoDraftProvider suốt luồng — rời hẳn luồng là mất,
 * còn job đã tạo thì bền trong DB ("Your videos").
 */
export default function VideoLayout() {
  return (
    <VideoDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </VideoDraftProvider>
  );
}
