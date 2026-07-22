/**
 * Fails if banned WhatsApp / browser-automation stacks appear in
 * package.json dependencies or under src/ and test/.
 *
 * Allowed: mentions in docs/, packages/, agents/, templates/, ADRs.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BANNED_PACKAGE_NAMES = [
  'whatsapp-web.js',
  'puppeteer',
  'puppeteer-core',
  'playwright',
  'playwright-core',
];

const BANNED_CONTENT = [
  /whatsapp-web\.js/i,
  /from\s+['"]puppeteer/i,
  /require\(\s*['"]puppeteer/i,
  /from\s+['"]playwright/i,
  /require\(\s*['"]playwright/i,
  /\bLocalAuth\b/,
  /\.wwebjs_auth\b/,
  /\.wwebjs_cache\b/,
  /puppeteer-core/i,
];

/** @type {string[]} */
const violations = [];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

// package.json dependency fields
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const field of [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]) {
  const block = pkg[field] || {};
  for (const name of Object.keys(block)) {
    const lower = name.toLowerCase();
    if (
      BANNED_PACKAGE_NAMES.some((b) => lower === b || lower.includes('whatsapp'))
    ) {
      violations.push(`package.json ${field}: banned package "${name}"`);
    }
    if (lower.includes('puppeteer') || lower.includes('playwright')) {
      violations.push(`package.json ${field}: banned package "${name}"`);
    }
  }
}

// src/ and test/ content
for (const rel of ['src', 'test']) {
  const dir = path.join(root, rel);
  let files = [];
  try {
    files = walk(dir);
  } catch {
    continue;
  }
  for (const file of files) {
    if (!/\.(js|mjs|cjs|ts|json)$/i.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const re of BANNED_CONTENT) {
      if (re.test(text)) {
        violations.push(`${path.relative(root, file)}: matches ${re}`);
      }
    }
  }
}

if (violations.length) {
  console.error('Banned stack check FAILED:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log('Banned stack check OK (no WhatsApp/Puppeteer/Playwright in runtime).');
