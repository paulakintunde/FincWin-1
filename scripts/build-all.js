#!/usr/bin/env node
'use strict';
const { execFileSync } = require('node:child_process');
const fs   = require('node:fs');
const path = require('node:path');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'build-manifest.json'), 'utf8'));
let failed = 0;

for (const { template, data, out } of manifest) {
  try {
    execFileSync('node', [path.join(__dirname, 'generate-page.js'),
      '--template', template, '--data', data, '--out', out],
      { cwd: process.cwd(), stdio: 'inherit' });
  } catch {
    console.error(`  FAILED: ${out}`);
    failed++;
  }
}

console.log(`\nBuilt ${manifest.length - failed}/${manifest.length} pages.`);
process.exit(failed ? 1 : 0);
