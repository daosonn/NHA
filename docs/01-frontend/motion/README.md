# NHA motion — bàn giao cho dev

Hai file cần copy:

- `nha-motion.css` — token (easing, duration), keyframes, class dùng lại. Import một lần ở root.
- `nha-cats.svg` — 4 con mèo dạng `<symbol>`: `cat-sitting`, `cat-happy`, `cat-sleeping`, `cat-peek`.

Bản demo sống: `NHA Motion Kit.dc.html` — mở trong trình duyệt, bấm thử từng thẻ. Mỗi thẻ có dòng spec mono ghi rõ duration và easing.

## Luật dùng

Chuyển động trầm cho thao tác lặp lại: nhấn nút, chuyển màn hình, sheet, tab, chip, khung xương AI.

Mèo chỉ ở ba chỗ xảy ra một lần và có cảm xúc: chờ AI trên 10 giây, trạng thái rỗng, và màn hình vừa gửi/vừa xong. Không đưa mèo vào chrome hay thao tác hàng ngày.

## Cách gắn

```html
<link rel="stylesheet" href="nha-motion.css" />

<button class="nha-press">Create your family</button>
<div class="nha-card">…</div>

<!-- nội dung vào so le -->
<h1 class="nha-enter" style="--i:0">This week at home</h1>
<li class="nha-enter" style="--i:1">…</li>
<li class="nha-enter" style="--i:2">…</li>

<!-- khung xương khi AI đang chạy -->
<div class="nha-skeleton" style="height:12px"></div>

<!-- sheet -->
<div class="nha-scrim" data-open="true"></div>
<div class="nha-sheet" data-open="true">…</div>

<!-- mèo -->
<svg width="96" height="104" style="animation:nhaBob 2600ms ease-in-out infinite">
  <use href="nha-cats.svg#cat-sitting"></use>
</svg>
```

## Ghi chú

Chỉ animate `transform` và `opacity`. Đừng animate `width`, `height`, `top`, `left` — giật trên máy yếu.

Gạch chân tab: set `--tab-x` và `--tab-w` bằng JS từ `offsetLeft` / `offsetWidth` của tab đang chọn.

Phát lại animation: `el.style.animation='none'; void el.offsetWidth; el.style.animation='';`

`prefers-reduced-motion` đã xử lý sẵn trong CSS.

Nếu app viết bằng React Native, các keyframe này không chạy trực tiếp — dùng bảng duration/easing ở đầu `nha-motion.css` với Reanimated, và export mèo thành component `react-native-svg`.
