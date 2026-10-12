const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('browser loads the shared CORS core before UI scripts', () => {
  const html = read('index.html');
  const core = html.indexOf('js/cors-core.js');
  const simulator = html.indexOf('js/cors-simulator.js');
  const live = html.indexOf('js/live-fetch.js');
  assert.ok(core >= 0 && core < simulator && core < live);
});

test('live fetch distinguishes CSP from indeterminate fetch failures', () => {
  const source = read('js/live-fetch.js');
  assert.match(source, /securitypolicyviolation/);
  assert.match(source, /CORS拒否ではありません/);
  assert.match(source, /TypeErrorだけでは、CORS拒否・通信断・DNS・TLSなどを断定できません/);
  assert.doesNotMatch(source, /CORSエラーの可能性が高い/);
});

test('live fetch restricts connections to the CSP allowlist', () => {
  const source = read('js/live-fetch.js');
  for (const origin of [
    'https://httpbin.org',
    'https://raw.githubusercontent.com',
    'https://example.com',
  ]) assert.match(source, new RegExp(origin.replaceAll('.', '\\.')));
  assert.match(source, /CorsCore\.inspectTarget/);
});

test('simulator uses core results rather than DOM rereads in final decision', () => {
  const source = read('js/cors-simulator.js');
  assert.match(source, /CorsCore\.needsPreflight/);
  assert.match(source, /CorsCore\.finalDecision/);
  const functionBody = source.slice(source.indexOf('function finalDecision'), source.indexOf('function formatCoreNote'));
  assert.doesNotMatch(functionBody, /Q\('simHeaders'\)/);
});

test('CSP and metadata do not claim unsupported header behavior', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /http-equiv="(?:X-Content-Type-Options|Permissions-Policy)"/i);
  assert.match(html, /script-src 'self';/);
  assert.doesNotMatch(html, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(html, /onclick=/);
});

test('interactive disclosure and dynamic results expose accessible state', () => {
  const html = read('index.html');
  assert.equal((html.match(/data-accordion-target=/g) || []).length, 7);
  assert.equal((html.match(/data-help-target=/g) || []).length, 2);
  assert.equal((html.match(/aria-live="polite"/g) || []).length, 4);
  assert.doesNotMatch(read('js/sop-lab.js'), /innerHTML/);
  assert.match(read('js/app.js'), /aria-expanded/);
});

test('mobile controls keep readable input size and all four tabs visible', () => {
  const css = read('css/style.css');
  assert.match(css, /grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /font-size:16px/);
  assert.match(css, /\.comparison-table,[\s\S]*overflow-x:auto/);
});
