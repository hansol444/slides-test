/**
 * push-server.js — HTML 저장 + 코멘트 저장 + git push 자동화
 */

const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const PORT = 4444;
const ROOT = __dirname;

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
        // Save HTML + push
        fs.writeFileSync(path.join(ROOT, 'index.html'), body, 'utf-8');
        const result = gitPush('index.html', 'Update slide');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));

      } else if (req.method === 'POST' && req.url === '/comment') {
        // Save comment.json + push
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
  console.log('Endpoints: POST /push (HTML), POST /comment (JSON)\n');
});
