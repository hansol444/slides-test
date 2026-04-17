/**
 * push-server.js — HTML 저장 + git push 자동화
 *
 * 사용법: node push-server.js
 */

const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const PORT = 4444;
const ROOT = __dirname;
const FILE = path.join(ROOT, 'index.html');

const server = http.createServer((req, res) => {
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
        fs.writeFileSync(FILE, body, 'utf-8');
        console.log(`Saved: ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`);

        // 2. Git add
        execSync('git add index.html', { cwd: ROOT });

        // 3. Check if there are changes to commit
        try {
          execSync('git diff --cached --quiet', { cwd: ROOT });
          // No changes
          console.log('No changes to commit. Skip.');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, message: 'No changes' }));
          return;
        } catch (e) {
          // Has changes — continue
        }

        // 4. Commit + push
        const timestamp = new Date().toLocaleString('ko-KR');
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
  console.log(`Push server: http://localhost:${PORT}`);
  console.log('Ready.\n');
});
