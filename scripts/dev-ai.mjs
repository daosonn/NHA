// Chạy AI service (apps/ai — FastAPI) bằng venv của nó, cross-platform.
//   pnpm dev:ai          → uvicorn app.main:app (host/port đọc từ apps/ai/.env)
//   pnpm test:ai         → pytest apps/ai/tests (mock mode, 0 token)
// venv chưa có? → tự tạo + cài requirements (idempotent, giống scripts/setup.mjs).

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const aiDir = path.join(root, 'apps', 'ai');
const isWin = process.platform === 'win32';
const venvPy = path.join(aiDir, '.venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: aiDir, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(venvPy)) {
  console.log('› Tạo venv cho apps/ai (lần đầu)…');
  const py = isWin ? 'python' : 'python3';
  run(py, ['-m', 'venv', '.venv']);
  run(venvPy, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);
  run(venvPy, ['-m', 'pip', 'install', '--quiet', '-r', 'requirements.txt']);
}

if (process.argv.includes('--test')) {
  run(venvPy, ['-m', 'pytest', 'tests', '-q']);
} else {
  run(venvPy, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000']);
}
