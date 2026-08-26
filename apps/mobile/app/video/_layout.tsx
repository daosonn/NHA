import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { VideoDraftProvider } from '../../src/features/video/draft';
import { prefetchNewsImages } from '../../src/fixtures/news';
import { screenTransition } from '../../src/theme/motion';

/**
 * Luồng Memory video (màn 27-33): Setup → Photos → Music → Style → Story & scenes →
 * Making/Done. Bản nháp sống trong VideoDraftProvider suốt luồng — rời hẳn luồng là mất,
 * còn job đã tạo thì bền trong DB ("Your videos").
 */
export default function VideoLayout() {
  // Ảnh quảng cáo Alpha Club của màn chờ render nạp vào cache NGAY khi người dùng
  // bước vào luồng tạo video (không nạp từ lúc mở app). Từ đây tới màn chờ còn
  // 4-5 bước, đủ để 8 ảnh (~280 KB) về xong → tới lúc cần là hiện ngay.
  useEffect(() => {
    prefetchNewsImages();
  }, []);

  return (
    <VideoDraftProvider>
      {/* Stack lồng không thừa hưởng screenOptions của root — spread lại,
          không thì luồng video là chỗ duy nhất mất chuyển màn của spec. */}
      <Stack screenOptions={{ headerShown: false, ...screenTransition }} />
    </VideoDraftProvider>
  );
}
