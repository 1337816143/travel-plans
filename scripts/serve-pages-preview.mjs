import console from 'node:console';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const port = Number(process.env.PAGES_PREVIEW_PORT ?? 4174);
const allowedTopLevelPaths = new Set([
  'assets',
  'index.html',
  'service-worker.js',
  'v3',
  'versions',
]);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl ?? '/', 'http://127.0.0.1');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/v3') return { redirect: '/v3/' };
  if (pathname.endsWith('/')) pathname += 'index.html';
  const relativePath = pathname.replace(/^\/+/, '');
  const [topLevel] = relativePath.split('/');
  if (!allowedTopLevelPaths.has(topLevel)) return null;
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  if (!absolutePath.startsWith(`${repositoryRoot}${path.sep}`)) return null;
  return { absolutePath };
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end('Method not allowed');
    return;
  }
  const resolved = resolveRequestPath(request.url);
  if (resolved?.redirect) {
    response.writeHead(308, { Location: resolved.redirect }).end();
    return;
  }
  if (!resolved?.absolutePath || !fs.existsSync(resolved.absolutePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  const stats = fs.lstatSync(resolved.absolutePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': stats.size,
    'Content-Type':
      contentTypes.get(path.extname(resolved.absolutePath)) ?? 'application/octet-stream',
  });
  if (request.method === 'HEAD') response.end();
  else fs.createReadStream(resolved.absolutePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Qingdao Pages preview: http://127.0.0.1:${port}/v3/`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
