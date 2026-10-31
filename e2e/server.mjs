// Tiny static file server for the built site: SITE_DIR=<dir> PORT=<port> node server.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.env.SITE_DIR || '../public');
const port = Number(process.env.PORT || 4171);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain',
};

const die = (msg) => { console.error(`server.mjs: ${msg}`); process.exit(1); };

if (!(await stat(root).catch(() => null))?.isDirectory()) die(`build directory ${root} is missing; build the site first (or set SITE_DIR).`);

const server = createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    let file = join(root, path);
    if (!file.startsWith(root)) throw new Error('outside root');
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') die(`port ${port} is already in use by another process; free it or pick another with E2E_PORT.`);
  die(err.message);
});
server.listen(port, () => console.log(`serving ${root} on :${port}`));
