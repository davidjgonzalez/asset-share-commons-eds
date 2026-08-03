import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contentTypeMatches,
  isHtmlResponse,
  rewriteHtmlContentSecurityPolicy,
  transformResponseHeaders,
} from './response-headers.js';

test('matches wildcard MIME patterns', () => {
  assert.equal(contentTypeMatches('application/pdf', '*/*'), true);
  assert.equal(contentTypeMatches('image/png', 'image/*'), true);
  assert.equal(contentTypeMatches('application/pdf', 'image/*'), false);
});

test('matches exact MIME types with parameters', () => {
  assert.equal(contentTypeMatches('application/pdf; charset=utf-8', 'application/pdf'), true);
});

test('matches regular expressions against content-type headers', () => {
  assert.equal(contentTypeMatches('application/vnd.adobe+json', /adobe\+json/i), true);
});

test('applies matching header overrides', () => {
  const headers = transformResponseHeaders(
    {
      'content-type': 'image/jpeg',
      connection: 'keep-alive',
    },
    '/content/dam/example.jpg',
    {
      headerOverrides: [{
        pathMatch: '/content/dam',
        contentType: 'image/*',
        set: { 'content-disposition': 'inline' },
      }],
    },
  );

  assert.equal(headers.connection, undefined);
  assert.equal(headers['content-disposition'], 'inline');
});

test('detects html responses', () => {
  assert.equal(isHtmlResponse({ 'content-type': 'text/html; charset=utf-8' }), true);
  assert.equal(isHtmlResponse({ 'content-type': 'application/pdf' }), false);
});

test('rewrites CSP meta tags in html responses', () => {
  const html = `<meta http-equiv="Content-Security-Policy" content="object-src 'none';">`;
  const rewritten = rewriteHtmlContentSecurityPolicy(html, "object-src 'self' blob: data:;");

  assert.equal(rewritten.includes("object-src 'self' blob: data:;"), true);
  assert.equal(rewritten.includes("object-src 'none';"), false);
});