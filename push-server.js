/**
 * push-server.js — HTML 저장 + git push 자동화
 *
 * 사용법: node push-server.js
 * 브라우저에서 "Save & Push" 누르면 자동으로:
 *   1. index.html 덮어쓰기
 *   2. git add + commit + push
 *   3. GitHub Pages 자동 업데이트 (1~2분)
 */

const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const PORT = 4444;
const ROOT = __dirname;
const FILE = path.join(ROOT, 'index.html');

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/push') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        // 1. Save HTML
        const html = '<!DOCTYPE html>\n<html lang="ko">\n' + body.replace(/^<!DOCTYPE html>\s*<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '') + '\n</html>';
        fs.writeFileSync(FILE, body, 'utf-8');
        console.log(`Saved: ${FILE} (${(Buffer.byteLength(body) / 1024).toFixed(1)} KB)`);

        // 2. Git add + commit + push
        const timestamp = new Date().toLocaleString('ko-KR');
        execSync('git add index.html', { cwd: ROOT });
        execSync(`git commit -m "Update: ${timestamp}"`, { cwd: ROOT });
        execSync('git push', { cwd: ROOT });
        console.log(`Pushed at ${timestamp}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, time: timestamp }));
      } catch (err) {
        console.error('Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Push server running: http://localhost:${PORT}`);
  console.log(`Watching: ${FILE}`);
  console.log('Browser에서 "Save & Push" 버튼 누르면 자동 git push됩니다.\n');
});
