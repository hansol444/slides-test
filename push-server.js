/**
 * push-server.js
 *
 * POST /push  — 슬라이드 내용(<main> innerHTML)만 받아서 원본 HTML에 끼워넣기
 * POST /comment — comment.json 저장
 *
 * 원본 HTML의 CSS, JS, 코멘트 패널 등은 절대 건드리지 않음.
 */

const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const PORT = 4444;
const ROOT = __dirname;
const FILE = path.join(ROOT, 'index.html');

function gitPush(files, msg) {
  execSync('git add ' + files, { cwd: ROOT });
  try {
    execSync('git diff --cached --quiet', { cwd: ROOT });
    return { ok: true, message: 'No changes' };
  } catch (e) { /* has changes */ }
  const timestamp = new Date().toLocaleString('ko-KR');
  execSync(`git commit -m "${msg}: ${timestamp}"`, { cwd: ROOT });
  execSync('git push', { cwd: ROOT });
  console.log(`Pushed: ${msg} at ${timestamp}`);
  return { ok: true, time: timestamp };
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      if (req.method === 'POST' && req.url === '/push') {
        // 원본 HTML 읽기
        const original = fs.readFileSync(FILE, 'utf-8');

        // <main id="slides">...</main> 부분만 교체
        const merged = original.replace(
          /(<main[^>]*id="slides"[^>]*>)([\s\S]*?)(<\/main>)/,
          '$1\n' + body + '\n$3'
        );

        fs.writeFileSync(FILE, merged, 'utf-8');
        console.log(`Saved (slides only): ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`);

        const result = gitPush('index.html', 'Update slide');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));

      } else if (req.method === 'POST' && req.url === '/comment') {
        fs.writeFileSync(path.join(ROOT, 'comment.json'), body, 'utf-8');
        const result = gitPush('comment.json', 'Comment');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));

      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (err) {
      console.error('Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Push server: http://localhost:${PORT}`);
  console.log('POST /push  = slides only merge (safe)');
  console.log('POST /comment = comment.json\n');
});
