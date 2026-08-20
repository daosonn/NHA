// ffmpeg/ffprobe process helper — port từ demo onemoretime (src/lib/video.ts, phần lõi).
// Render 100% local, 0 token; KHÔNG bao giờ gửi media cho model từ tầng này.

import { spawn } from 'child_process';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

export const FFMPEG = ffmpegPath as unknown as string;
export const FFPROBE = (ffprobeStatic as { path: string }).path;

export function run(
  bin: string,
  args: string[],
  opts?: { okNonZero?: boolean },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || opts?.okNonZero) resolve({ stdout, stderr });
      else
        reject(
          new Error(
            `${path.basename(bin)} exit ${code}: ${stderr.slice(-500)}`,
          ),
        );
    });
  });
}

export type MediaProbe = { duration: number; hasAudio: boolean };

export async function probeMedia(absPath: string): Promise<MediaProbe> {
  const { stdout } = await run(FFPROBE, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-show_entries',
    'stream=codec_type',
    '-of',
    'json',
    absPath,
  ]);
  const j = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: { codec_type?: string }[];
  };
  return {
    duration: Number(j.format?.duration ?? 0),
    hasAudio: (j.streams ?? []).some((s) => s.codec_type === 'audio'),
  };
}
