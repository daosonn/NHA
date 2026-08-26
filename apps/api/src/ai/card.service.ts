import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PrismaService } from '../database/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { FFMPEG, run } from '../video/engine/exec';
import {
  loadFonts,
  maxUnitsFor,
  stripLatinDiacritics,
  wrapLines,
} from '../video/engine/videogen';
import { AiContextService } from './ai-context.service';

/**
 * Thiệp (màn 26 · 11g) — render server-side, 0 token.
 *
 * Nền là 15 bức hoa màu nước do Sơn thiết kế (assets/card-templates, xem
 * README ở đó) thay cho 5 mẫu SVG vẽ tay cũ. Vì nền giờ là TRANH, mỗi mẫu
 * phải khai báo VÙNG TRỐNG dành cho chữ — hoa của mẫu này mọc từ đáy thì chữ
 * nằm trên, mẫu kia ôm hết mép trái thì chữ dạt phải; đặt chữ giữa mọi mẫu
 * như bản cũ là chữ đè lên hoa.
 *
 * Chữ vẫn vẽ bằng ffmpeg drawtext + fontfile (KHÔNG vẽ trong SVG — librsvg
 * không thấy font hệ thống, kana/kanji ra dấu hỏi, đã dính 19/08).
 *
 * Trả về một Media row (không gắn post) — mobile hiển thị qua GET /media/:id,
 * còn "share với family" thì tạo post đính media này như mọi post khác.
 */

/** Chữ nằm ở đâu trên nền — theo chỗ mà bức tranh chừa ra. */
type CardZone = 'top' | 'center' | 'lower' | 'right';

export const CARD_TEMPLATE_IDS = [
  't01',
  't02',
  't03',
  't04',
  't05',
  't06',
  't07',
  't09',
  't10',
  't11',
  't12',
  't13',
  't15',
  't16',
  't17',
] as const;

export type CardTemplateId = (typeof CARD_TEMPLATE_IDS)[number];

// 3:4 — đúng khổ file trong assets/card-templates, nền không bị crop.
// (Bản 5 mẫu cũ là 1080×1520; mobile preview đổi aspectRatio theo.)
const W = 1080;
const H = 1440;

type Template = {
  zone: CardZone;
  /** màu thân lời nhắn — tối, ăn theo tông tranh */
  ink: string;
  /** màu "Dear …" + ký tên — màu hoa của chính mẫu đó */
  accent: string;
  /** màu dòng dịp phía trên — nhạt hơn accent */
  sub: string;
};

/**
 * Bảng mẫu — `apps/mobile/app/ai/card.tsx` giữ bản sao y hệt (zone + màu) để
 * preview client nói cùng một điều với PNG server. Màu lấy theo tông từng bức.
 * id đặt theo số thứ tự bộ thiết kế gốc của Sơn (t08/t14 không tồn tại).
 */
const TEMPLATES: Record<CardTemplateId, Template> = {
  t01: { zone: 'center', ink: '#4A4C3A', accent: '#647353', sub: '#8A8F76' }, // suzuran — linh lan 2 góc
  t02: { zone: 'top', ink: '#2E3036', accent: '#C26A55', sub: '#8B8E96' }, // anemone — hoa dồn đáy
  t03: { zone: 'right', ink: '#6B5260', accent: '#A86379', sub: '#A38A96' }, // sweet pea — hoa leo mép trái
  t04: { zone: 'top', ink: '#664A39', accent: '#B3743F', sub: '#A08874' }, // ranunculus — hoa dồn đáy
  t05: { zone: 'center', ink: '#5B5445', accent: '#AB8A3E', sub: '#948A72' }, // mẫu đơn trắng — vòng hoa
  t06: { zone: 'center', ink: '#6A4F3C', accent: '#C47A50', sub: '#A78B77' }, // cúc đào — vòng hoa
  t07: { zone: 'center', ink: '#4F4634', accent: '#A2762C', sub: '#8F8468' }, // khung hoa cottage
  t09: { zone: 'center', ink: '#414D69', accent: '#5F74A8', sub: '#7F89A3' }, // cẩm tú cầu 4 góc
  t10: { zone: 'center', ink: '#494E42', accent: '#6D7D4E', sub: '#878E7C' }, // hoa đồng nội
  t11: { zone: 'center', ink: '#5A4A2B', accent: '#A9822F', sub: '#998A68' }, // cúc vàng
  t12: { zone: 'center', ink: '#74424E', accent: '#B8617A', sub: '#A5838E' }, // mẫu đơn hồng
  t13: { zone: 'center', ink: '#7C5260', accent: '#C26B85', sub: '#AA8A96' }, // anh đào
  t15: { zone: 'lower', ink: '#5E4930', accent: '#B06F28', sub: '#9C8867' }, // vườn cam — quả ôm mép trên
  t16: { zone: 'top', ink: '#565142', accent: '#9C7A52', sub: '#918A76' }, // đồng cỏ chiều — hoa cao nửa dưới
  t17: { zone: 'lower', ink: '#575065', accent: '#8878AD', sub: '#8F8A9E' }, // tử đằng — hoa rủ mép trên
};

/** Fallback khi id lọt qua validate mà không có trong bảng (không bao giờ nên xảy ra). */
const DEFAULT_TEMPLATE: CardTemplateId = 't15';

const ASSETS_DIR = () => path.join(process.cwd(), 'assets', 'card-templates');

/** Đường dẫn cho filter ffmpeg (dấu \ và : phải escape). */
function ffPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

const CJK_RE =
  /[\u2E80-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

// Chữ Việt có thanh điệu (ơ ư ạ ế …) nằm ở Latin Extended-B/Additional — Georgia
// trên Windows chỉ phủ tới Extended-A nên ra tofu (đã dính); Times/Palatino/Cambria
// phủ đủ (kiểm bằng cmap, 8/8 glyph thử).
const VN_RE = /[\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]/;

/**
 * Thiệp dùng font CÓ CHÂN (mincho/serif), không phải font UI của video.
 * Thiệp là giấy in — Yu Gothic/Segoe UI làm nó trông như một cái form.
 */
function cardFont(
  text: string,
  fallback: { vn: string | null; jp: string | null },
): string | null {
  const dir = 'C:\\Windows\\Fonts';
  const cands = CJK_RE.test(text)
    ? ['yumindb.ttf', 'yumin.ttf', 'YuMincho.ttc']
    : VN_RE.test(text)
      ? ['timesbd.ttf', 'palab.ttf', 'cambriab.ttf', 'times.ttf']
      : ['georgiab.ttf', 'timesbd.ttf', 'georgia.ttf', 'times.ttf'];
  for (const f of cands) {
    const p = path.join(dir, f);
    if (existsSync(p)) return p;
  }
  return CJK_RE.test(text)
    ? (fallback.jp ?? fallback.vn)
    : (fallback.vn ?? fallback.jp);
}

/** "BIRTHDAY" → "B I R T H D A Y" — drawtext không có letter-spacing. */
function spaced(text: string): string {
  return Array.from(text).join(' ');
}

@Injectable()
export class CardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly context: AiContextService,
  ) {}

  /**
   * File nền của một mẫu — cho GET /cards/templates/:id/image (public, để
   * mobile vẽ picker + preview bằng đúng bức tranh sẽ nằm trong PNG).
   */
  templateImage(template: string): { path: string; size: number } {
    if (!(template in TEMPLATES)) {
      throw new NotFoundException(`Không có mẫu thiệp "${template}"`);
    }
    const p = path.join(ASSETS_DIR(), `${template}.jpg`);
    if (!existsSync(p)) {
      // Asset được commit thẳng vào repo — thiếu là repo hỏng, không phải request hỏng.
      throw new NotFoundException(
        `Thiếu file nền ${template}.jpg trong assets/card-templates`,
      );
    }
    return { path: p, size: statSync(p).size };
  }

  async render(
    userId: string,
    familyId: string,
    input: {
      template: CardTemplateId;
      message: string;
      toName: string;
      fromName: string;
      heading?: string;
    },
  ): Promise<{ media_id: string }> {
    await this.context.assertMembership(userId, familyId);
    const id: CardTemplateId =
      input.template in TEMPLATES ? input.template : DEFAULT_TEMPLATE;
    const t = TEMPLATES[id];

    // ---- 1) Nền: bức tranh của mẫu, phủ kín đúng khổ (asset đã là 1080×1440
    // nên resize gần như no-op — giữ để an toàn nếu ai thay file khác khổ) ----
    const base = path.join(
      this.storage.tempDir,
      `card_base_${randomUUID()}.png`,
    );
    await mkdir(path.dirname(base), { recursive: true });
    await sharp(this.templateImage(id).path)
      .resize(W, H, { fit: 'cover' })
      .png()
      .toFile(base);

    // ---- 2) Chữ: ffmpeg drawtext với FONTFILE, đặt vào VÙNG TRỐNG của mẫu ----
    // Vùng 'right' (hoa ôm mép trái): khối chữ hẹp lại và dịch tâm sang phải.
    const xOff = t.zone === 'right' ? 168 : 0;
    const wrapWidth = t.zone === 'right' ? 470 : W - 280;

    const fonts = loadFonts();
    const tmp = path.join(this.storage.tempDir, `card_${randomUUID()}.png`);
    const layers: string[] = [];

    const draw = async (
      text: string,
      size: number,
      color: string,
      y: number,
    ) => {
      const raw = text.trim();
      if (!raw) return;
      const font = cardFont(raw, fonts);
      if (!font) return;
      // Font Nhật không có glyph dấu Latin → bỏ dấu để không ra tofu
      const body = CJK_RE.test(raw) ? stripLatinDiacritics(raw) : raw;
      const tf = path.join(
        this.storage.tempDir,
        `card_txt_${randomUUID()}.txt`,
      );
      await writeFile(tf, body, 'utf8');
      layers.push(
        `drawtext=fontfile='${ffPath(font)}':textfile='${ffPath(tf)}'` +
          `:fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2${xOff ? `+${xOff}` : ''}:y=${Math.round(y)}`,
      );
    };

    // Dịp tự thêm dài tới 80 ký tự nhưng thiệp chỉ có một dòng — cắt hiển thị
    // ở 40, còn validate thì không cắt (xem CardRenderDto).
    const headingRaw = (input.heading ?? '').trim();
    const heading =
      headingRaw.length > 40
        ? `${headingRaw.slice(0, 39).trimEnd()}…`
        : headingRaw;
    const hasHeading = heading.length > 0;
    const hasDear = input.toName.trim().length > 0;

    const msgSize = 36;
    const lineH = 52;
    const lines = wrapLines(input.message, maxUnitsFor(wrapWidth, msgSize), 10);

    // Khối chữ xếp dọc: dịp → Dear → lời nhắn → ký tên. Tính TỔNG CAO trước
    // rồi mới neo theo vùng — mẫu 'lower' mà neo kiểu cũ (băng cố định giữa
    // trang) là lời nhắn dài chui ngược lên giàn hoa.
    const headingBlock = hasHeading ? 30 + 30 : 0; // chữ + khoảng thở
    const dearBlock = hasDear ? 54 + 36 : 0;
    const messageBlock = lines.length * lineH + 38;
    const signatureBlock = 40;
    const totalH = headingBlock + dearBlock + messageBlock + signatureBlock;

    // Neo theo vùng trống của tranh. Hai vế min/max giữ khối chữ không tràn
    // khỏi mép giấy khi lời nhắn dài bất thường (validate cho tới 600 ký tự).
    const margin = 100;
    let y0: number;
    if (t.zone === 'top') {
      y0 = 128;
    } else if (t.zone === 'lower') {
      y0 = Math.min(Math.round(H * 0.42), H - totalH - margin);
    } else {
      y0 = Math.round((H - totalH) / 2);
    }
    y0 = Math.max(margin, y0);

    let y = y0;
    if (hasHeading) {
      // Latin thì giãn chữ cho ra dáng "BIRTHDAY"; tiếng Nhật đã đủ thoáng.
      // Giãn làm bề rộng gần gấp đôi nên chỉ giãn khi còn ngắn.
      const isLatin = /^[\u0020-\u024F]+$/.test(heading);
      await draw(
        isLatin
          ? heading.length <= 22
            ? spaced(heading.toUpperCase())
            : heading.toUpperCase()
          : heading,
        30,
        t.sub,
        y,
      );
      y += headingBlock;
    }
    // Tên rỗng thì không chào ai cả — một dòng "Dear " lơ lửng là lỗi in ấn.
    if (hasDear) {
      await draw(`Dear ${input.toName}`, 54, t.accent, y);
      y += dearBlock;
    }
    for (const line of lines) {
      await draw(line, msgSize, t.ink, y);
      y += lineH;
    }
    y += 38;
    // Ký tên có gạch HAI ĐẦU — một đầu trông như bị cắt mất (Sơn nhặt ra 19/08)
    await draw(`— ${input.fromName} —`, 38, t.accent, y);

    await run(FFMPEG, [
      '-y',
      '-i',
      base,
      '-vf',
      layers.join(','),
      '-frames:v',
      '1',
      tmp,
    ]);

    const storageKey = await this.storage.promote(tmp, 'image/png');
    const png = await sharp(await this.storage.readAll(storageKey)).toBuffer();

    const media = await this.prisma.media.create({
      data: {
        uploaderUserId: userId,
        storageKey,
        mimeType: 'image/png',
        sizeBytes: png.length,
      },
      select: { id: true },
    });
    return { media_id: media.id };
  }
}
