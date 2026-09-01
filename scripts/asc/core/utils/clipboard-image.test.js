import test from 'node:test';
import assert from 'node:assert/strict';
import { canCopyImage } from './clipboard-image.js';

test('copy-image accepts supported bitmap renditions', () => {
  assert.equal(canCopyImage({ url: '/asset', mimeType: 'image/jpeg' }), true);
  assert.equal(canCopyImage({ url: '/asset.webp' }), true);
});

test('copy-image rejects non-images and SVG', () => {
  assert.equal(canCopyImage({ url: '/asset', mimeType: 'video/mp4' }), false);
  assert.equal(canCopyImage({ url: '/asset.svg', mimeType: 'image/svg+xml' }), false);
  assert.equal(canCopyImage({ url: '/asset-without-extension' }), false);
});
