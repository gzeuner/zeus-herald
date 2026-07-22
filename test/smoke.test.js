import { test } from 'node:test';
import assert from 'node:assert/strict';
import { version } from '../src/index.js';

test('foundation exports a version string', () => {
  assert.equal(typeof version, 'string');
  // semver core or prerelease (e.g. 0.2.0-alpha)
  assert.match(version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
});
