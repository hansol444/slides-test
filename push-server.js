/**
 * push-server.js — HTML 저장 + 코멘트 저장 + git push 자동화
 *
 * 핵심: 브라우저에서 받은 HTML에서 <main> 안 슬라이드 내용만 추출하고,
 * 나머지(CSS, JS, 코멘트 패널 등)는 원본 파일에서 유지.
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

function mergeSlideContent(browserHtml) {
  // 원본 파일 읽기
  const original = fs.readFileSync(FILE, 'utf-8');

  // 브라우저 HTML에서 <main>...</main> 추출
  const browserMainMatch = browserHtml.match(/<main[^>]*id="slides"[^>]*>([\s\S]*?)<\/main>/);
  if (!browserMainMatch) {
    console.log('Warning: <main> not found in browser HTML. Skipping merge.');
    return null;
  }

  // 원본에서 <main>...</main> 교체
  const merged = original.replace(
    /(<main[^>]*id="slides"[^>]*>)([\s\S]*?)(<\/main>)/,
    '$1' + browserMainMatch[1] + '$3'
  );

  return merged;
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
        // Merge: 슬라이드 내용만 브라우저에서, 나머지는 원본 유지
        const merged = mergeSlideContent(body);
        if (merged) {
          fs.writeFileSync(FILE, merged, 'utf-8');
          console.log(`Saved (merged): ${(Buffer.byteLength(merged) / 1024).toFixed(1)} KB`);
        } else {
          fs.writeFileSync(FILE, body, 'utf-8');
          console.log(`Saved (raw): ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`);
        }
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
  console.log('Endpoints: POST /push (HTML merge), POST /comment (JSON)\n');
});
