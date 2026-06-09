#!/usr/bin/env node
// Usage:
//   node scripts/generate-page.js --template feature-page --data scripts/data/feature-loan-payoff-calculator.json --out features/loan-payoff-calculator.html

'use strict';

const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const get  = (flag) => { const i = args.indexOf(flag); return i > -1 ? args[i + 1] : null; };

const templateName = get('--template');
const dataFile     = get('--data');
const outFile      = get('--out');

if (!templateName || !dataFile || !outFile) {
  console.error('Usage: node scripts/generate-page.js --template <name> --data <json> --out <path>');
  process.exit(1);
}

const templatePath = path.join(__dirname, 'templates', templateName + '.html');
if (!fs.existsSync(templatePath)) {
  console.error(`Template not found: ${templatePath}`);
  process.exit(1);
}

const dataPath = path.join(process.cwd(), dataFile);
if (!fs.existsSync(dataPath)) {
  console.error(`Data file not found: ${dataPath}`);
  process.exit(1);
}

let html      = fs.readFileSync(templatePath, 'utf8');
const data    = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const partDir = path.join(__dirname, 'partials');

// 1) Inject partials: {{> name}} -> scripts/partials/name.html
html = html.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name) => {
  const p = path.join(partDir, name + '.html');
  if (!fs.existsSync(p)) { console.error(`Partial not found: ${p}`); process.exit(1); }
  return fs.readFileSync(p, 'utf8').trimEnd();
});

// 2) Replace {{TOKEN}} from data
const warnings = [];
html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!(key in data)) { warnings.push(key); return `{{${key}}}`; }
  return data[key];
});

// 3) Guard: fail if any marker survived
const leftover = html.match(/\{\{\s*>?\s*\w+\s*\}\}/g);
if (leftover) {
  console.error(`ERROR: unresolved markers in output: ${[...new Set(leftover)].join(', ')}`);
  process.exit(1);
}

const outPath = path.join(process.cwd(), outFile);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');

if (warnings.length) console.warn(`  Warning: no data value for: ${[...new Set(warnings)].join(', ')}`);
console.log(`  Written: ${outFile}`);
