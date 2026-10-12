const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/cors-core.js');

test('CORS safelist checks header values, not only names', () => {
  assert.equal(core.isSafelistedHeader('Content-Type', 'text/plain;charset=UTF-8'), true);
  assert.equal(core.isSafelistedHeader('Content-Type', 'application/json'), false);
  assert.equal(core.isSafelistedHeader('Accept-Language', 'ja-JP,en;q=0.9'), true);
  assert.equal(core.isSafelistedHeader('Accept-Language', 'ja_JP'), false);
  assert.equal(core.isSafelistedHeader('Range', 'bytes=0-499'), true);
  assert.equal(core.isSafelistedHeader('Range', 'bytes=0-99,200-299'), false);
});

test('preflight is derived from method and complete header entries', () => {
  assert.equal(core.needsPreflight('GET', []), false);
  assert.equal(core.needsPreflight('POST', [{ name: 'Content-Type', value: 'text/plain' }]), false);
  assert.equal(core.needsPreflight('POST', [{ name: 'Content-Type', value: 'application/json' }]), true);
  assert.equal(core.needsPreflight('PUT', []), true);
  assert.equal(core.needsPreflight('GET', [{ name: 'X-Demo', value: '1' }]), true);
});

test('ACAM and ACAH wildcard work only without credentials', () => {
  const base = {
    origin: 'https://app.example',
    method: 'PUT',
    requestHeaders: [{ name: 'X-Demo', value: '1' }],
    response: { acao: 'https://app.example', acam: '*', acah: '*' },
  };
  assert.equal(core.finalDecision({ ...base, credentials: false }).ok, true);
  assert.equal(core.finalDecision({ ...base, credentials: true }).ok, false);
});

test('ACAH wildcard does not match Authorization', () => {
  const result = core.finalDecision({
    origin: 'https://app.example',
    credentials: false,
    method: 'GET',
    requestHeaders: [{ name: 'Authorization', value: 'Bearer demo' }],
    response: { acao: '*', acah: '*' },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.notes.at(-1).values, { headers: 'authorization' });
});

test('credentials require exact ACAO and case-sensitive ACAC true', () => {
  const config = {
    origin: 'https://app.example', credentials: true, method: 'GET', requestHeaders: [],
  };
  assert.equal(core.finalDecision({ ...config, response: { acao: '*', acac: 'true' } }).ok, false);
  assert.equal(core.finalDecision({ ...config, response: { acao: config.origin, acac: 'True' } }).ok, false);
  assert.equal(core.finalDecision({ ...config, response: { acao: config.origin, acac: 'true' } }).ok, true);
});

test('header parser reports malformed lines without inventing values', () => {
  const parsed = core.parseHeaderLines('X-Demo: one\nBroken\nBad Name: value');
  assert.deepEqual(parsed.headers, [{ name: 'X-Demo', value: 'one' }]);
  assert.deepEqual(parsed.errors, [
    { line: 2, key: 'invalidHeaderLine' },
    { line: 3, key: 'invalidHeaderName' },
  ]);
});

test('target inspection enforces exact CSP origins before fetch', () => {
  const allowed = ['https://httpbin.org'];
  assert.equal(core.inspectTarget('https://httpbin.org/get', 'https://app.example/', allowed).ok, true);
  assert.equal(core.inspectTarget('https://evil.example/', 'https://app.example/', allowed).reason, 'cspNotAllowed');
  assert.equal(core.inspectTarget('/local.json', 'https://app.example/', allowed).reason, 'invalidUrl');
  assert.equal(core.inspectTarget('file:///tmp/a', 'https://app.example/', allowed).reason, 'unsupportedScheme');
});

test('combined safelisted value size over 1024 bytes triggers preflight', () => {
  const headers = Array.from({ length: 9 }, (_, index) => ({
    name: index % 2 ? 'Accept-Language' : 'Content-Language',
    value: 'a'.repeat(120),
  }));
  assert.equal(core.needsPreflight('GET', headers), true);
});
