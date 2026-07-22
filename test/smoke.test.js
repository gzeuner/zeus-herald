import { test } from 'node:test';
import assert from 'node:assert/strict';
import { version } from '../src/index.js';

test('foundation exports a version string', () => {
  assert.equal(typeof version, 'string');
  assert.match(version, /^\d+\.\d+\.\d+$/);
});
