import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('package.json has no whatsapp or puppeteer dependencies', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const all = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.optionalDependencies,
    ...pkg.peerDependencies,
  };
  for (const name of Object.keys(all || {})) {
    const lower = name.toLowerCase();
    assert.equal(lower.includes('whatsapp'), false, name);
    assert.equal(lower.includes('puppeteer'), false, name);
    assert.equal(lower.includes('playwright'), false, name);
  }
});

test('entrypoint does not reference banned messaging stacks', () => {
  const index = readFileSync(path.join(root, 'src', 'index.js'), 'utf8');
  assert.equal(/whatsapp/i.test(index), false);
  assert.equal(/puppeteer/i.test(index), false);
  assert.equal(/wwebjs/i.test(index), false);
});
