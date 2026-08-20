import { useRef, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

export const BUDGET_MAX = 20000;
const STEP = 500;
const MARKS = [0, 5000, 10000, 15000, 20000];

/** Đường kính núm kéo. Tâm núm chạy trong [R, width − R], không phải [0, width]. */
const HANDLE = 24;
const R = HANDLE / 2;
/** Bề rộng hộp chữ của mỗi mốc thang — dùng để căn giữa nhãn dưới đúng vị trí giá trị. */
const LABEL_W = 62;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** "3.000" — the mockup writes thousands with dots (11a). */
export function formatJpy(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "3.000〜8.000円", open-ended at the top: "15.000円〜". */
export function budgetLabel(lo: number, hi: number): string {
  if (hi >= BUDGET_MAX)
    return lo === 0 ? `〜${formatJpy(BUDGET_MAX)}円+` : `${formatJpy(lo)}円〜`;
  return `${formatJpy(lo)}〜${formatJpy(hi)}円`;
}

/**
 * Toạ độ TÂM núm cho một giá trị. Trừ hai đầu một bán kính núm: nếu map thẳng
 * 0 → x=0 thì ở giá trị nhỏ nhất nửa núm nằm ngoài thanh, và nhãn "0" dưới thang
 * lại không đứng dưới núm.
 */
export function xForValue(value: number, width: number): number {
  const usable = Math.max(1, width - HANDLE);
  return R + (clamp(value, 0, BUDGET_MAX) / BUDGET_MAX) * usable;
}

/** Nghịch đảo của `xForValue`, đã chốt về bậc STEP. Hai hàm PHẢI khớp nhau. */
export function valueAtX(x: number, width: number): number {
  const usable = Math.max(1, width - HANDLE);
  const fraction = clamp((x - R) / usable, 0, 1);
  return Math.round((fraction * BUDGET_MAX) / STEP) * STEP;
}

export type BudgetSliderProps = {
  value: [number, number];
  onChange: (value: [number, number]) => void;
};

/**
 * Thanh ngân sách hai đầu của màn 21 (11a).
 *
 * Một responder duy nhất trên cả vùng cao 44px: bấm đâu cũng bắt lấy núm GẦN NHẤT
 * rồi kéo, nên chạm và kéo đều chạy trên web lẫn điện thoại mà không cần thư viện
 * gesture. Hai điều dễ sai đã được xử lý ở đây:
 *  - toạ độ lấy theo `pageX` trừ mép trái đã đo, KHÔNG dùng `locationX`: locationX
 *    được tính theo phần tử bị chạm, nên khi ngón tay rơi vào dải màu/núm thì nó
 *    lệch đúng bằng vị trí của phần tử đó và thanh nhảy (lỗi Sơn gặp 20/08);
 *  - mọi thứ vẽ bên trên đều `pointerEvents="none"` để không tự giành sự kiện.
 */
export function BudgetSlider({ value, onChange }: BudgetSliderProps) {
  const [width, setWidth] = useState(0);
  const [lo, hi] = value;
  // Núm mà cử chỉ hiện tại đang giữ — chọn lúc chạm, giữ suốt lúc kéo, nên kéo
  // núm này vượt qua núm kia cũng không bị đổi vai giữa đường.
  const active = useRef<'lo' | 'hi' | null>(null);
  const originX = useRef(0);
  const box = useRef<View>(null);

  const xFromEvent = (e: GestureResponderEvent): number => {
    const { pageX, locationX } = e.nativeEvent;
    return typeof pageX === 'number' && pageX !== 0 ? pageX - originX.current : locationX;
  };

  const move = (v: number) => {
    // Giữ hai núm cách nhau ít nhất một bậc: một khoảng ngân sách rộng 0 đồng
    // không có nghĩa gì, mà lại làm hai núm dính vào nhau không tách ra được.
    if (active.current === 'lo') onChange([Math.min(v, hi - STEP), hi]);
    else if (active.current === 'hi') onChange([lo, Math.max(v, lo + STEP)]);
  };

  return (
    <View style={{ gap: 4 }}>
      <View
        ref={box}
        onLayout={() => {
          box.current?.measureInWindow((x, _y, w) => {
            originX.current = x;
            setWidth(w);
          });
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          const x = xFromEvent(e);
          // Chọn theo khoảng cách PIXEL tới từng núm, không theo giá trị: khi hai
          // núm gần nhau thì pixel mới là thứ người dùng thực sự nhắm vào.
          const dLo = Math.abs(x - xForValue(lo, width));
          const dHi = Math.abs(x - xForValue(hi, width));
          active.current = dLo === dHi ? (x >= xForValue(hi, width) ? 'hi' : 'lo') : dLo < dHi ? 'lo' : 'hi';
          move(valueAtX(x, width));
        }}
        onResponderMove={(e) => move(valueAtX(xFromEvent(e), width))}
        onResponderRelease={() => {
          active.current = null;
        }}
        onResponderTerminate={() => {
          active.current = null;
        }}
        // Vùng chạm cao hơn thanh nhìn thấy — ngón tay không cần đặt chính xác 5px.
        style={{ height: 44, justifyContent: 'center' }}
      >
        {/* rãnh: chỉ trải giữa hai tâm núm để đầu thanh không thừa ra ngoài */}
        <View
          pointerEvents="none"
          style={{
            marginHorizontal: R,
            height: 5,
            borderRadius: 3,
            backgroundColor: colors.background.subtle,
          }}
        />

        {width > 0 && (
          <>
            {/* vạch mốc — để mắt thấy núm đang dừng đúng trên con số nào */}
            {MARKS.map((m) => (
              <View
                key={`tick-${m}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: xForValue(m, width) - 0.5,
                  bottom: 6,
                  width: 1,
                  height: 5,
                  backgroundColor: colors.state.borderNeutral,
                }}
              />
            ))}

            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: xForValue(lo, width),
                width: Math.max(0, xForValue(hi, width) - xForValue(lo, width)),
                height: 5,
                borderRadius: 3,
                backgroundColor: colors.coral.primary,
              }}
            />

            {([lo, hi] as const).map((v, i) => (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: xForValue(v, width) - R,
                  width: HANDLE,
                  height: HANDLE,
                  borderRadius: radius.full,
                  backgroundColor: colors.background.card,
                  borderWidth: 1.5,
                  borderColor: colors.coral.primary,
                  boxShadow: '0 1px 5px rgba(24,24,27,0.18)',
                }}
              />
            ))}
          </>
        )}
      </View>

      {/* Thang: 0 · 5.000 · 10.000 · 15.000 · 20.000円+
          Đặt tuyệt đối, căn giữa ĐÚNG toạ độ của giá trị — trước đây dùng
          space-between nên các hộp chữ bị dàn đều và số lệch khỏi núm. */}
      <View style={{ height: 15 }} pointerEvents="none">
        {width > 0 &&
          MARKS.map((m, i) => (
            <Text
              key={m}
              variant="badge"
              color={colors.text.subtle}
              style={{
                position: 'absolute',
                left: clamp(xForValue(m, width) - LABEL_W / 2, 0, Math.max(0, width - LABEL_W)),
                width: LABEL_W,
                textAlign: 'center',
              }}
            >
              {i === MARKS.length - 1 ? `${formatJpy(m)}円+` : formatJpy(m)}
            </Text>
          ))}
      </View>
    </View>
  );
}
