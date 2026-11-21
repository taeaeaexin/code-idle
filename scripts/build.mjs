// 토스 미니앱 빌드: 게임 파일을 dist 폴더로 복사하고, 토스 기능 연결 스크립트를 넣음
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const out = 'dist';
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'favicon.ico', 'css', 'js', 'fonts']) cpSync(f, out + '/' + f, { recursive: true });

await build({ entryPoints: ['scripts/toss-bridge.js'], bundle: true, minify: true, format: 'iife', target: 'es2019', outfile: out + '/js/toss-bridge.js' });

// 게임 스크립트보다 먼저 불러오도록 index.html에 끼워 넣음
const html = readFileSync(out + '/index.html', 'utf8');
const tag = '<script src="js/data.js">';
if (!html.includes(tag)) throw new Error('index.html에서 data.js 스크립트 태그를 찾지 못했습니다');
writeFileSync(out + '/index.html', html.replace(tag, '<script src="js/toss-bridge.js"></script>\n' + tag));
console.log('dist 폴더 준비 완료');
