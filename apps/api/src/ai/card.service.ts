import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PrismaService } from '../database/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { FFMPEG, run } from '../video/engine/exec';
import { loadFonts, maxUnitsFor, stripLatinDiacritics, wrapLines } from '../video/engine/videogen';
import { AiContextService } from './ai-context.service';

/**
 * Thiệp (màn 26 · 11g) — render server-side bằng SVG → sharp → PNG, 0 token.
 * 5 mẫu theo design: Marigold · Birthday · Tulip · Tết · Kraft.
 * Trả về một Media row (không gắn post) — mobile hiển thị qua GET /media/:id,
 * còn "share với family" thì tạo post đính media này như mọi post khác.
 */

export type CardTemplateId = 'marigold' | 'birthday' | 'tulip' | 'tet' | 'kraft';

const W = 1080;
const H = 1520;

type Theme = { bg: string; frame: string; accent: string; ink: string; sub: string; deco: (t: Theme) => string };

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Hoa cúc vạn thọ — vòng cánh hoa đơn giản quanh 1 nhụy */
function flower(cx: number, cy: number, r: number, petal: string, core: string): string {
  const petals = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return `<ellipse cx="${cx + Math.cos(a) * r}" cy="${cy + Math.sin(a) * r}" rx="${r * 0.62}" ry="${r * 0.38}" fill="${petal}" transform="rotate(${(a * 180) / Math.PI}, ${cx + Math.cos(a) * r}, ${cy + Math.sin(a) * r})"/>`;
  }).join('');
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="${core}"/>`;
}

/**
 * Bốn góc một nét cong mảnh — thứ làm tấm thiệp trông "được in" chứ không phải
 * một khung chữ nhật. Vẽ 1 góc rồi lật qua tâm cho ba góc còn lại.
 */
function corners(color: string, inset: number, len: number): string {
  const a = inset;
  const b = inset + len;
  const one = (x1: number, y1: number, x2: number, y2: number, cx: number, cy: number) =>
    `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.75"/>`;
  return [
    one(a, b, b, a, a, a),
    one(W - a, b, W - b, a, W - a, a),
    one(a, H - b, b, H - a, a, H - a),
    one(W - a, H - b, W - b, H - a, W - a, H - a),
  ].join('');
}

/**
 * Bảng màu ĐẬM đúng mockup 11g (thiệp giấy màu, không phải giấy trắng viền màu).
 * `apps/mobile/app/ai/card.tsx` giữ y hệt bộ này — preview phải trùng PNG.
 */
const THEMES: Record<CardTemplateId, Theme> = {
  marigold: {
    bg: '#F7DE8B', frame: '#B98A1F', accent: '#8A6B14', ink: '#4A3B22', sub: '#8A6B14',
    deco: (t) => flower(W - 150, 170, 46, t.frame, t.accent) + flower(150, H - 170, 34, t.frame, t.accent),
  },
  birthday: {
    bg: '#F9C89B', frame: '#C2652F', accent: '#A9531F', ink: '#43302C', sub: '#8C4F26',
    deco: (t) =>
      [0, 1, 2, 3, 4].map((i) => `<circle cx="${140 + i * 200}" cy="${i % 2 ? 150 : 190}" r="${14 + (i % 3) * 6}" fill="${i % 2 ? t.frame : t.accent}" opacity="0.65"/>`).join('') +
      `<rect x="${W / 2 - 3}" y="120" width="6" height="70" fill="${t.accent}"/><path d="M ${W / 2 - 40} 120 q 40 -50 80 0 z" fill="${t.frame}"/>`,
  },
  tulip: {
    bg: '#F6C9DC', frame: '#B7548E', accent: '#8E3E6C', ink: '#5A2C44', sub: '#96477A',
    deco: (t) =>
      [0, 1, 2].map((i) => {
        const x = 170 + i * 90;
        return `<path d="M ${x} 200 q -22 -44 0 -66 q 22 22 0 66" fill="${t.frame}"/><path d="M ${x} 200 v 62" stroke="${t.accent}" stroke-width="6" fill="none"/>`;
      }).join(''),
  },
  tet: {
    bg: '#A62B22', frame: '#E8B84B', accent: '#F6D77E', ink: '#FFF4DC', sub: '#F0CFA0',
    deco: (t) =>
      `<circle cx="${W - 160}" cy="170" r="60" fill="none" stroke="${t.frame}" stroke-width="5"/>` +
      `<circle cx="${W - 160}" cy="170" r="40" fill="${t.frame}" opacity="0.3"/>` +
      [0, 1, 2, 3, 4].map((i) => flower(120 + i * 30, H - 150 + (i % 2) * 20, 12, '#F6D77E', '#E8B84B')).join(''),
  },
  kraft: {
    bg: '#E7DCC8', frame: '#8A744C', accent: '#6B5B3E', ink: '#463A26', sub: '#7C6C50',
    deco: (t) =>
      `<line x1="120" y1="150" x2="${W - 120}" y2="150" stroke="${t.frame}" stroke-width="3" stroke-dasharray="2 10"/>` +
      `<line x1="120" y1="${H - 150}" x2="${W - 120}" y2="${H - 150}" stroke="${t.frame}" stroke-width="3" stroke-dasharray="2 10"/>`,
  },
};

/** Đường dẫn cho filter ffmpeg (dấu \ và : phải escape). */
function ffPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

const CJK_RE = /[\u2E80-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

/**
 * Thiệp dùng font CÓ CHÂN (mincho/serif), không phải font UI của video.
 * Thiệp là giấy in — Yu Gothic/Segoe UI làm nó trông như một cái form.
 */
function cardFont(text: string, fallback: { vn: string | null; jp: string | null }): string | null {
  const dir = 'C:\\Windows\\Fonts';
  const cands = CJK_RE.test(text)
    ? ['yumindb.ttf', 'yumin.ttf', 'YuMincho.ttc']
    : ['georgiab.ttf', 'timesbd.ttf', 'georgia.ttf', 'times.ttf'];
  for (const f of cands) {
    const p = path.join(dir, f);
    if (existsSync(p)) return p;
  }
  return CJK_RE.test(text) ? (fallback.jp ?? fallback.vn) : (fallback.vn ?? fallback.jp);
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

  async render(
    userId: string,
    familyId: string,
    input: { template: CardTemplateId; message: string; toName: string; fromName: string; heading?: string },
  ): Promise<{ media_id: string }> {
    await this.context.assertMembership(userId, familyId);
    const t = THEMES[input.template] ?? THEMES.marigold;

    // ---- 1) Nền + khung + hoa văn: SVG → sharp (hình khối thì librsvg vẽ tốt) ----
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.5"/>
          <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0"/>
          <stop offset="100%" stop-color="${t.frame}" stop-opacity="0.09"/>
        </linearGradient>
      </defs>

      <rect width="${W}" height="${H}" fill="${t.bg}"/>
      <rect width="${W}" height="${H}" fill="url(#paper)"/>

      <rect x="46" y="46" width="${W - 92}" height="${H - 92}" fill="none" stroke="${t.frame}" stroke-width="5" rx="30"/>
      <rect x="64" y="64" width="${W - 128}" height="${H - 128}" fill="none" stroke="${t.frame}" stroke-width="1.5" rx="22" opacity="0.55"/>
      ${corners(t.frame, 84, 58)}
      ${t.deco(t)}

      <!-- gạch ngắn dưới tên + hai chấm nhỏ hai bên, đúng mockup 11g -->
      <line x1="${W / 2 - 92}" y1="446" x2="${W / 2 + 92}" y2="446" stroke="${t.frame}" stroke-width="2.5"/>
      <circle cx="${W / 2 - 108}" cy="446" r="4" fill="${t.accent}"/>
      <circle cx="${W / 2 + 108}" cy="446" r="4" fill="${t.accent}"/>
    </svg>`;

    const base = path.join(this.storage.tempDir, `card_base_${randomUUID()}.png`);
    await mkdir(path.dirname(base), { recursive: true });
    await writeFile(base, await sharp(Buffer.from(svg)).png().toBuffer());

    // ---- 2) Chữ: ffmpeg drawtext với FONTFILE ----
    // KHÔNG vẽ chữ trong SVG: librsvg trong sharp không thấy font hệ thống nên
    // mọi ký tự kana/kanji ra dấu hỏi (đã dính 19/08). Engine video vẽ chữ Nhật
    // bằng drawtext + fontfile và chạy đúng — thiệp dùng lại đúng cách đó.
    const fonts = loadFonts();
    const tmp = path.join(this.storage.tempDir, `card_${randomUUID()}.png`);
    const layers: string[] = [];

    const draw = async (text: string, size: number, color: string, y: number) => {
      const raw = text.trim();
      if (!raw) return;
      const font = cardFont(raw, fonts);
      if (!font) return;
      // Font Nhật không có glyph dấu Latin → bỏ dấu để không ra tofu
      const body = CJK_RE.test(raw) ? stripLatinDiacritics(raw) : raw;
      const tf = path.join(this.storage.tempDir, `card_txt_${randomUUID()}.txt`);
      await writeFile(tf, body, 'utf8');
      layers.push(
        `drawtext=fontfile='${ffPath(font)}':textfile='${ffPath(tf)}'` +
          `:fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}`,
      );
    };

    const heading = (input.heading ?? '').trim();
    if (heading) {
      // Latin thì giãn chữ cho ra dáng "BIRTHDAY"; tiếng Nhật đã đủ thoáng
      const isLatin = !/[^ -ɏ\s]/.test(heading);
      await draw(isLatin ? spaced(heading.toUpperCase()) : heading, 34, t.sub, 272);
    }
    await draw(`Dear ${input.toName}`, 62, t.ink, 344);

    // Xuống dòng theo bề rộng hiển thị + kinsoku (tiếng Nhật không có dấu cách)
    const size = 38;
    const lines = wrapLines(input.message, maxUnitsFor(W - 240, size), 10);
    const lineH = 54;
    // Căn giữa khối chữ trong VÙNG giữa gạch dưới tên và dòng ký tên — căn giữa
    // theo cả trang thì lời nhắn tụt xuống và chừa một khoảng trống lớn ở đáy.
    const bandTop = 520;
    const bandBottom = H - 300;
    const startY = (bandTop + bandBottom) / 2 - ((lines.length - 1) * lineH) / 2;
    for (const [i, line] of lines.entries()) await draw(line, size, t.ink, startY + i * lineH);

    // Ký tên có gạch HAI ĐẦU — một đầu trông như bị cắt mất (Sơn nhặt ra 19/08)
    await draw(`— ${input.fromName} —`, 42, t.accent, H - 262);

    await run(FFMPEG, ['-y', '-i', base, '-vf', layers.join(','), '-frames:v', '1', tmp]);

    const storageKey = await this.storage.promote(tmp, 'image/png');
    const png = await sharp(storageKey ? this.storage.absolutePathOf(storageKey) : tmp).toBuffer();

    const media = await this.prisma.media.create({
      data: { uploaderUserId: userId, storageKey, mimeType: 'image/png', sizeBytes: png.length },
      select: { id: true },
    });
    return { media_id: media.id };
  }
}
