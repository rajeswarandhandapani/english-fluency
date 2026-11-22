// Small local static server for this PWA. Usage: npm start
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'pwa-kit.json'), 'utf8'));
  } catch {
    return {};
  }
}

const cfg = loadConfig();
const PORT = Number(process.env.PORT) || Number(cfg.port) || 4177;
const TITLE = cfg.name || path.basename(ROOT);
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
const PUBLIC = /^\/(index\.html|styles\.css|manifest\.webmanifest|sw\.js|lib\/[\w-]+\.(js|css)|js\/[\w-]+\.js|icons\/[\w-]+\.png)$/;

function start(port = PORT) {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/index.html';
    if (!PUBLIC.test(url)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    fs.readFile(path.join(ROOT, url), (err, body) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(url)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (require.main === module) start().then(() => console.log(`${TITLE}: http://localhost:${PORT}`));
module.exports = { start };
