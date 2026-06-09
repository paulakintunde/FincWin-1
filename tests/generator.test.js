import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-'));

function run(args) {
  return execFileSync('node', ['scripts/generate-page.js', ...args], {
    cwd: ROOT, encoding: 'utf8',
  });
}

describe('generate-page.js', () => {
  it('injects nav, footer and scripts partials', () => {
    const out = path.join(tmp, 'mint.html');
    run(['--template', 'competitor-alt', '--data', 'scripts/data/mint-alt.json', '--out', path.relative(ROOT, out)]);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('id="mainNav"');            // nav partial
    expect(html).toContain('class="mkt-footer"');      // footer partial
    expect(html).toContain('src="/js/mkt.js"');        // scripts partial (external, CSP-safe)
  });

  it('leaves no unreplaced {{TOKEN}} or {{> partial}} markers', () => {
    const out = path.join(tmp, 'mint2.html');
    run(['--template', 'competitor-alt', '--data', 'scripts/data/mint-alt.json', '--out', path.relative(ROOT, out)]);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).not.toMatch(/\{\{\s*>?\s*\w+\s*\}\}/);
  });

  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
});

describe('full site build', () => {
  it('builds every manifest page with no leftover markers', () => {
    execFileSync('node', ['scripts/build-all.js'], { cwd: ROOT, encoding: 'utf8' });
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/build-manifest.json'), 'utf8'));
    for (const { out } of manifest) {
      const html = fs.readFileSync(path.join(ROOT, out), 'utf8');
      expect(html, `${out} has leftover marker`).not.toMatch(/\{\{\s*>?\s*\w+\s*\}\}/);
      expect(html, `${out} missing nav`).toContain('id="mainNav"');
      expect(html, `${out} missing footer`).toContain('class="mkt-footer"');
    }
  });
});
