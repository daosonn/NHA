// Kiểu dùng chung của engine video — port từ demo onemoretime (src/types.ts, phần video).
// Giữ nguyên shape để videogen/introgen/videoTiming/cardTiming port không phải sửa logic.

export type SceneType = 'kenburns' | 'video_clip' | 'sora_candidate';
// 'static' chỉ do hệ thống gán (phân bổ kiểu iPhone Memories — videoTiming.assignEffects)
export type SceneEffect =
  'zoom_in' | 'zoom_out' | 'pan_lr' | 'pan_rl' | 'pan_ud' | 'pan_du' | 'static';
export type VideoStyle = 'yasashii' | 'kandou' | 'kazoku';
export type Aspect = 'landscape' | 'portrait';

// 6 phong cách card mở đầu/kết (màn 30 của design: Album/Cinematic/Old film/Letter/Petals/Polaroid)
export type IntroTemplateId =
  'album' | 'cinema' | 'film' | 'letter' | 'seasonal' | 'polaroid' | 'none';
// 'memories' là mặc định: cut đúng nhịp + Ken Burns cực nhẹ + counter-slide/bloom/whip
export type EffectProfile =
  'off' | 'soft' | 'cinematic' | 'vintage' | 'memories';
export type MusicThemeId =
  'birthday' | 'wafu' | 'family' | 'nostalgia' | 'gentle';

export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  text_on_dark: string;
}

export interface Scene {
  media_id: string;
  type: SceneType;
  duration_s: number;
  caption_ja: string;
  caption_vi: string;
  effect: SceneEffect;
  ai_animate: boolean;
  motion_prompt: string;
  reason: string;
}
