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
  const messages = read('js/messages.js');
  assert.match(source, /securitypolicyviolation/);
  assert.match(source, /liveText\('liveCspPrecheck'\)/);
  assert.match(messages, /CORS拒否ではありません/);
  assert.match(messages, /TypeErrorだけでは、CORS拒否・通信断・DNS・TLSなどを断定できません/);
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
  assert.doesNotMatch(source, /function\s+(?:isSimpleRequest|needsPreflight|finalDecision)\s*\(/u);
  assert.doesNotMatch(source, /const\s+SAFE_(?:METHODS|HEADERS|CONTENT_TYPES)\b/u);
  assert.match(source, /CorsCore\.responseHeaderExposure/);
  assert.match(source, /CorsCore\.modelPreflightCache/);
  assert.doesNotMatch(source, /innerHTML/);
});

test('all simulator input mutations rerender derived results', () => {
  const source = read('js/cors-simulator.js');
  for (const id of ['simMethod', 'simHeaders', 'simCred', 'simACEH', 'simResponseHeaders', 'simMaxAge', 'simSecondAfter']) {
    assert.match(source, new RegExp(`'${id}'`));
  }
  assert.match(source, /addEventListener\('input', doSimulate\)/);
  assert.match(source, /addEventListener\('change', doSimulate\)/);
});

test('shared scenarios restore and evaluate while excluding live-fetch data', () => {
  const source = read('js/cors-simulator.js');
  assert.match(source, /CorsCore\.encodeScenario\(collectScenario\(\)\)/);
  assert.match(source, /applyScenario\(CorsCore\.decodeScenario\(location\.hash\)\)/);
  assert.match(source, /simulatorTab\.click\(\)/);
  assert.match(source, /doSimulate\(\);\s*$/);
  const collector = source.slice(source.indexOf('function collectScenario'), source.indexOf('function applyScenario'));
  for (const forbidden of ['liveUrl', 'liveHeaders', 'liveBody', 'liveLog', 'pmMessage', 'pmLog']) {
    assert.doesNotMatch(collector, new RegExp(forbidden));
  }
});

test('language switching stores only safe session state and restores UI selection', () => {
  const source = read('js/app.js');
  assert.match(source, /sessionStorage\.setItem\(SESSION_STATE_KEY/);
  assert.match(source, /CorsSimulatorState\.collectScenario\(\)/);
  assert.match(source, /activeTab/);
  assert.match(source, /openAccordions/);
  assert.match(source, /target\.hash = location\.hash/);
  for (const forbidden of ['liveUrl', 'liveHeaders', 'liveBody', 'liveLog', 'pmMessage', 'pmLog']) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
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
  assert.equal((html.match(/aria-live="polite"/g) || []).length, 7);
  assert.doesNotMatch(read('js/sop-lab.js'), /innerHTML/);
  assert.match(read('js/app.js'), /aria-expanded/);
});

test('SOP lab frames use restrictive CSPs', () => {
  for (const file of ['labs/iframe-safe.html', 'labs/iframe-safe.en.html']) {
    const html = read(file);
    assert.match(html, /default-src 'none'; script-src 'self'/);
    assert.match(html, /src="iframe-lab\.js"/);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  }

  for (const file of ['labs/iframe-sandboxed.html', 'labs/iframe-sandboxed.en.html']) {
    const html = read(file);
    assert.match(html, /default-src 'none'; script-src 'sha256-/);
    assert.doesNotMatch(html, /script-src[^;]*'unsafe-inline'/);
    assert.match(html, /event\.source!==parent/);
  }

  const source = read('labs/iframe-lab.js');
  assert.match(source, /event\.source !== parent/);
  assert.match(source, /event\.origin !== ownOrigin/);
  assert.match(source, /location\.protocol === 'file:'/);
  assert.match(read('js/sop-lab.js'), /location\.protocol === 'file:'/);
});

test('mobile controls keep readable input size and all four tabs visible', () => {
  const css = read('css/style.css');
  assert.match(css, /grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /font-size:16px/);
  assert.match(css, /\.comparison-table,[\s\S]*overflow-x:auto/);
});

test('English page has all functional controls and bilingual scripts', () => {
  const html = read('index.en.html');
  const ids = [
    'themeToggle', 'frameSafe', 'frameSandboxed', 'btnReadSafe', 'btnReadSandboxed',
    'btnPostMessage', 'pmLog', 'btnSimulate', 'simMethod', 'simContentType',
    'simHeaders', 'simCred', 'simACAO', 'simACAC', 'simACAM', 'simACAH',
    'simACEH', 'simResponseHeaders', 'simExposeResult', 'simMaxAge', 'simSecondAfter',
    'simSameRequest', 'simCacheTimeline', 'btnSimShare', 'btnSimClearShare', 'simShareStatus',
    'simFlow', 'simExplain', 'btnLiveGo', 'liveUrl', 'liveMethod', 'liveCT',
    'liveCred', 'liveHeaders', 'liveBody', 'liveLog',
  ];
  ids.forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  assert.match(read('js/messages.js'), /ja:\s*\{/);
  assert.match(read('js/messages.js'), /en:\s*\{/);
  assert.match(read('js/language-init.js'), /navigator\.language/);
  assert.match(read('js/language-init.js'), /explicitDocument/);
});

test('both language pages expose the response-header and preflight-cache learning panels', () => {
  for (const file of ['index.html', 'index.en.html']) {
    const html = read(file);
    for (const id of ['simACEH', 'simResponseHeaders', 'simExposeResult', 'simMaxAge', 'simSecondAfter', 'simSameRequest', 'simCacheTimeline']) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(html, /This is not a browser measurement|これはブラウザーの実測ではありません/);
  }
});

test('English static UI has no Japanese outside the language link', () => {
  const html = read('index.en.html').replace('>日本語<', '>Japanese<');
  assert.doesNotMatch(html, /[\u3040-\u30ff\u3400-\u9fff]/);
});

test('dynamic message catalogs have identical keys', () => {
  const { catalog } = require('../js/messages.js');
  assert.deepEqual(Object.keys(catalog.en).sort(), Object.keys(catalog.ja).sort());
});
