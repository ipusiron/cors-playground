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

test('response header exposure follows safelist, ACEH, credentials, and forbidden names', () => {
  const open = core.responseHeaderExposure({
    credentials: false,
    responseHeaders: 'Content-Type, X-Trace, Set-Cookie',
    exposeHeaders: '*',
  });
  assert.deepEqual(open.readable.map((entry) => entry.name), ['Content-Type', 'X-Trace']);
  assert.deepEqual(open.unreadable, [{ name: 'Set-Cookie', reason: 'forbidden' }]);

  const credentialed = core.responseHeaderExposure({
    credentials: true,
    responseHeaders: 'Content-Type, X-Trace, Set-Cookie2',
    exposeHeaders: '*',
  });
  assert.deepEqual(credentialed.readable.map((entry) => entry.name), ['Content-Type']);
  assert.deepEqual(credentialed.unreadable.map((entry) => entry.reason), ['credentialWildcardLiteral', 'forbidden']);

  const explicit = core.responseHeaderExposure({
    credentials: true,
    responseHeaders: 'X-Trace',
    exposeHeaders: 'x-trace',
  });
  assert.deepEqual(explicit.readable, [{ name: 'X-Trace', reason: 'explicit' }]);
});

test('invalid ACEH syntax exposes only safelisted response headers', () => {
  const result = core.responseHeaderExposure({
    credentials: false,
    responseHeaders: 'Content-Length, X-Trace',
    exposeHeaders: 'X-Trace, Bad Name',
  });
  assert.deepEqual(result.invalidExposeHeaders, ['Bad Name']);
  assert.deepEqual(result.readable.map((entry) => entry.name), ['Content-Length']);
  assert.deepEqual(result.unreadable.map((entry) => entry.name), ['X-Trace']);
});

test('preflight cache timeline models hit, expiry, changed conditions, and no-preflight cases', () => {
  assert.equal(core.modelPreflightCache({ preflightRequired: true, maxAge: 600, secondRequestAfter: 30 }).reused, true);
  assert.equal(core.modelPreflightCache({ preflightRequired: true, maxAge: 30, secondRequestAfter: 30 }).reused, false);
  assert.equal(core.modelPreflightCache({ preflightRequired: true, maxAge: 600, secondRequestAfter: 1, sameRequest: false }).events[1].reason, 'conditionsChanged');
  assert.equal(core.modelPreflightCache({ preflightRequired: false, maxAge: 600, secondRequestAfter: 1 }).events[1].reason, 'notRequired');
  assert.equal(core.modelPreflightCache({ preflightRequired: true, maxAge: '', secondRequestAfter: 4 }).maxAge, 5);
});

test('share scenario round-trips only the strict allowlisted schema', () => {
  const scenario = {
    method: 'POST', contentType: 'application/json', requestHeaders: 'X-Demo', credentials: false,
    acao: '*', acac: '', acam: 'POST', acah: 'Content-Type, X-Demo', aceh: 'X-Trace',
    responseHeaders: 'Content-Type, X-Trace', maxAge: 600, secondRequestAfter: 30,
  };
  const fragment = core.encodeScenario(scenario);
  assert.match(fragment, /^cors=v1\.[0-9A-Za-z_-]+$/);
  assert.deepEqual(core.decodeScenario(`#${fragment}`), scenario);
  assert.doesNotMatch(fragment, /X-Demo|X-Trace/);
});

test('share scenario rejects missing, unknown, oversized, and invalid fields', () => {
  const valid = {
    method: 'GET', contentType: '', requestHeaders: '', credentials: false,
    acao: '*', acac: '', acam: '', acah: '', aceh: '', responseHeaders: '', maxAge: 5, secondRequestAfter: 1,
  };
  assert.throws(() => core.encodeScenario({ ...valid, method: 'TRACE' }), /invalid:method/);
  assert.throws(() => core.encodeScenario({ ...valid, requestHeaders: 'x'.repeat(513) }), /invalid:requestHeaders/);
  assert.throws(() => core.encodeScenario({ ...valid, acao: 'ok\nInjected' }), /invalid:acao/);
  assert.throws(() => core.decodeScenario('#cors=v1.not_base64!'), /invalidEncoding/);

  const compact = { m: 'GET', ct: '', rh: '', cr: false, ao: '*', ac: '', am: '', ah: '', eh: '', sh: '', ma: 5, sd: 1, url: 'https://secret.example' };
  const payload = Buffer.from(JSON.stringify(compact)).toString('base64url');
  assert.throws(() => core.decodeScenario(`#cors=v1.${payload}`), /unknownField/);
});
