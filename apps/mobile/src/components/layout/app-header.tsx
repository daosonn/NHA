import { BlurView } from 'expo-blur';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, spacing } from '../../theme';
import { ContentColumn } from './content-column';

const HEIGHT = 56;

export type AppHeaderProps = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  /** 16 when the right slot is a 40px icon button, so the icon optically aligns. */
  paddingRight?: number;
};

/**
 * The same chrome on every screen: translucent page colour over a blur, and
 * **no border** — only the soft shadow separates it from the content that
 * scrolls underneath.
 *
 * The blurred bar spans the window; the row inside it does not. Chrome that
 * stops short of the edge stops reading as chrome, and the shadow has to
 * reach both sides for the content to look like it is passing beneath
 * something. But the wordmark and the bell belong to the column below them:
 * left unbounded they sat 1300px apart at 1440, on opposite sides of a
 * 600px page.
 */
export function AppHeader({ left, center, right, paddingRight = spacing.xl }: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={40}
      tint="light"
      style={[
        {
          paddingTop: insets.top,
          backgroundColor: colors.background.headerBlur,
          zIndex: 10,
        },
        elevation.header,
      ]}
    >
      {/* `bleed`: the row sets its own side padding, and the right side is a
          prop because a 40px icon button needs 16 to align optically. */}
      <ContentColumn bleed>
        <View
          style={{
            height: HEIGHT,
            paddingLeft: spacing.xl,
            paddingRight,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {/* Hai "ray" hai bên flex:1 nên LUÔN rộng bằng nhau — tiêu đề mới thật
              sự nằm giữa. Bản cũ space-between với <View /> rỗng (width 0) đẩy
              tâm tiêu đề lệch (rộng-trái − rộng-phải)/2: màn có nút back mà không
              có chuông là tiêu đề dạt phải ~16px, và tiêu đề còn NHẢY khi slot
              phải xuất hiện/biến mất theo điều kiện (vd nút "đọc hết" của màn
              thông báo). */}
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            {left}
          </View>
          <View style={{ flexShrink: 1, alignItems: 'center' }}>{center}</View>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            {right}
          </View>
        </View>
      </ContentColumn>
    </BlurView>
  );
}

AppHeader.HEIGHT = HEIGHT;
