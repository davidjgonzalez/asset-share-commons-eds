/**
 * ASC local dev split-proxy
 *
 * Routes requests between aem up (localhost:3000) and AEM (localhost:4503),
 * with configurable response-header overrides (CORS, Content-Disposition, etc.).
 *
 * Zero npm dependencies — pure Node.js built-ins only.
 *
 * Usage:
 *   npm run proxy          (from project root)
 *   node tools/local-dev-proxy/index.js
 *
 * Then open http://localhost:3002 instead of http://localhost:3000
 */

import http from 'node:http';
import config from './config.js';
import {
  HOP_BY_HOP,
  isHtmlResponse,
  rewriteHtmlContentSecurityPolicy,
  transformResponseHeaders,
} from './response-headers.js';

const { port = 3002, targets, routes = [], cors = false, headerOverrides = [] } = config;

// ─── Routing ──────────────────────────────────────────────────────────────────

function resolveTarget(pathname) {
  for (const { match, target } of routes) {
    if (pathname === match || pathname.startsWith(`${match}/`) || pathname.startsWith(`${match}?`)) {
      return new URL(targets[target] ?? target);
    }
  }
  return new URL(targets.aemUp ?? 'http://localhost:3000');
}

function forwardRequestHeaders(incoming, targetHost, targetOrigin) {
  const out = Object.fromEntries(
    Object.entries(incoming).filter(([k]) => !HOP_BY_HOP.has(k)),
  );
  delete out['accept-encoding'];
  out.host = targetHost;
  out.origin = targetOrigin;
  return out;
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const pathname = (req.url ?? '/').split('?')[0];

  // Handle CORS preflight before proxying
  if (req.method === 'OPTIONS' && cors) {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
      'access-control-max-age': '86400',
    });
    res.end();
    return;
  }

  const target = resolveTarget(pathname);
  const targetOrigin = `${target.protocol}//${target.host}`;

  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: Number(target.port) || 80,
      path: req.url,
      method: req.method,
      headers: forwardRequestHeaders(req.headers, target.host, targetOrigin),
    },
    (proxyRes) => {
      const proxyOrigin = `http://localhost:${port}`;
      const outHeaders = transformResponseHeaders(proxyRes.headers, pathname, { cors, headerOverrides, targetOrigin, proxyOrigin });
      const htmlCsp = outHeaders['content-security-policy'];

      if (!htmlCsp || !isHtmlResponse(outHeaders)) {
        res.writeHead(proxyRes.statusCode, outHeaders);
        proxyRes.pipe(res, { end: true });
        return;
      }

      const chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      proxyRes.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8');
        const rewritten = rewriteHtmlContentSecurityPolicy(html, htmlCsp);
        delete outHeaders['content-length'];
        res.writeHead(proxyRes.statusCode, outHeaders);
        res.end(rewritten);
      });
    },
  );

  proxyReq.on('error', (err) => {
    console.error(`  [error] ${req.method} ${req.url} → ${target.origin}  ${err.message}`);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq, { end: true });
});

// ─── WebSocket passthrough (required for aem up live-reload) ─────────────────

server.on('upgrade', (req, socket, head) => {
  const pathname = (req.url ?? '/').split('?')[0];
  const target = resolveTarget(pathname);

  const proxyReq = http.request({
    hostname: target.hostname,
    port: Number(target.port) || 80,
    path: req.url,
    method: 'GET',
    headers: { ...req.headers, host: target.host },
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket) => {
    const statusLine = `HTTP/1.1 ${proxyRes.statusCode} Switching Protocols\r\n`;
    const headerBlock = Object.entries(proxyRes.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    socket.write(`${statusLine}${headerBlock}\r\n\r\n`);
    if (head?.length) proxySocket.unshift(head);
    proxySocket.pipe(socket, { end: true });
    socket.pipe(proxySocket, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(`  [ws error] ${req.url}  ${err.message}`);
    socket.destroy();
  });

  proxyReq.end();
});

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(port, () => {
  const W = 30;
  console.log(`\n  ASC dev proxy  →  http://localhost:${port}\n`);
  console.log('  Routes (first match wins):');
  for (const { match, target } of routes) {
    console.log(`    ${match.padEnd(W)} →  ${targets[target] ?? target}`);
  }
  if (cors) {
    console.log('\n  CORS: all origins allowed (Access-Control-Allow-Origin: *)');
  }
  if (headerOverrides.length) {
    console.log('  Header overrides:');
    for (const o of headerOverrides) {
      const cond = [o.pathMatch, o.contentType && `type:${String(o.contentType)}`].filter(Boolean).join('  ');
      const sets = Object.entries(o.set).map(([k, v]) => `${k}: ${v}`).join('; ');
      console.log(`    [${cond || 'all'}]  →  ${sets}`);
    }
  }
  console.log('');
});
