/**
 * push-server.js
 *
 * GET /          — index.html 서빙
 * GET /*.json    — comment.json 등 정적 파일 서빙
 * POST /push     — 슬라이드 내용만 받아서 원본 HTML에 머지
 * POST /comment  — comment.json 저장 + git push
 */

const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const PORT = 4444;
const ROOT = __dirname;
const FILE = path.join(ROOT, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // === GET: 정적 파일 서빙 ===
  if (req.method === 'GET') {
    let filePath = req.url.split('?')[0];
    if (filePath === '/') filePath = '/index.html';
    const fullPath = path.join(ROOT, filePath);
    const ext = path.extname(fullPath);

    if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(fullPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // === POST: push / comment ===
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      if (req.method === 'POST' && req.url === '/push') {
        const original = fs.readFileSync(FILE, 'utf-8');
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
  console.log(`Server: http://localhost:${PORT}`);
  console.log('Open this URL in browser to view slides.\n');
});
