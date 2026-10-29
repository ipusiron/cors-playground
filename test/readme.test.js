const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/cors-core.js');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const ja = read('README.md');
const en = read('README.en.md');

function headings(markdown) {
  return markdown.match(/^#{2,3} .+$/gm) || [];
}

test('Japanese front matter and language navigation remain present', () => {
  assert.match(ja, /^<!--\r?\n---\r?\nid: day100/m);
  assert.match(ja, /\[English\]\(README\.en\.md\) · 日本語/);
  assert.match(en, /^English · \[日本語\]\(README\.md\)/);
});

test('Japanese and English documentation have matching heading levels', () => {
  const jaLevels = headings(ja).map((line) => line.match(/^#+/)[0].length);
  const enLevels = headings(en).map((line) => line.match(/^#+/)[0].length);
  assert.equal(jaLevels.length, 30);
  assert.deepEqual(enLevels, jaLevels);
});

test('both READMEs describe all four tabs and matching screenshot paths', () => {
  assert.match(ja, /4つのタブ構成/);
  assert.match(en, /Four tabs/);
  for (const name of ['screenshot.png', 'screenshot2.png']) {
    assert.match(ja, new RegExp(`assets/${name.replace('.', '\\.')}`));
    assert.match(en, new RegExp(`assets/en/${name.replace('.', '\\.')}`));
  }
});

test('documented preflight examples agree with the core', () => {
  assert.equal(core.needsPreflight('GET', []), false);
  assert.equal(core.needsPreflight('POST', [{ name: 'Content-Type', value: 'application/json' }]), true);
  assert.equal(core.needsPreflight('GET', [{ name: 'Authorization', value: 'Bearer demo' }]), true);
  for (const markdown of [ja, en]) {
    assert.match(markdown, /application\/json/);
    assert.match(markdown, /Authorization/);
    assert.match(markdown, /OPTIONS/);
  }
});

test('limits and diagnostic boundaries are equally documented', () => {
  for (const markdown of [ja, en]) {
    assert.match(markdown, /128/);
    assert.match(markdown, /1,024/);
    assert.match(markdown, /TypeError/);
    assert.match(markdown, /DNS/);
    assert.match(markdown, /TLS/);
    assert.match(markdown, /X-Content-Type-Options/);
    assert.match(markdown, /Permissions-Policy/);
    assert.match(markdown, /Access-Control-Max-Age/);
    assert.match(markdown, /Set-Cookie2/);
    assert.match(markdown, /sessionStorage/);
    assert.match(markdown, /Live Fetch/);
    assert.match(markdown, /postMessage/);
    assert.match(markdown, /Vary: Origin/);
    assert.match(markdown, /SameSite/);
    assert.match(markdown, /Secure/);
    assert.match(markdown, /Domain/);
    assert.match(markdown, /Path/);
  }
});

test('both READMEs separate CORS permission, cookie transmission, and HTTP caching', () => {
  assert.match(ja, /CORS許可だけではCookie送信を証明しない/);
  assert.match(en, /CORS success does not prove that a cookie was sent/);
  assert.match(ja, /プリフライトキャッシュとは別/);
  assert.match(en, /separately from the preflight cache/);
  assert.match(ja, /本リクエストが送られない/);
  assert.match(en, /stops before the actual request/);
});

test('all local Markdown links resolve', () => {
  for (const [filename, markdown] of [['README.md', ja], ['README.en.md', en]]) {
    const links = [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
    for (const link of links) {
      if (/^(?:https?:|#)/.test(link)) continue;
      const target = decodeURIComponent(link.split('#', 1)[0]);
      assert.ok(fs.existsSync(path.join(root, target)), `${filename}: missing ${target}`);
    }
  }
});

// The label is plain text, not a heading, so the heading-level test above keeps its count.
function useCaseItems(markdown, sectionHeading, label) {
  const text = markdown.replace(/\r\n/g, '\n');
  const start = text.indexOf(`\n${sectionHeading}\n`);
  assert.ok(start >= 0, `missing ${sectionHeading}`);
  const body = text.slice(start + sectionHeading.length + 2);
  const lead = body.slice(0, body.search(/^#{2,3} /m)).split('\n').filter((line) => line.trim());
  assert.equal(lead[0], label, `${sectionHeading} must start with "${label}"`);
  const items = [];
  for (const line of lead.slice(1)) {
    if (!line.startsWith('- ')) break;
    items.push(line.slice(2));
  }
  return items;
}

const jaUses = () => useCaseItems(ja, '## 🎓 活用シナリオ', 'このツールならではの使い方');
const enUses = () => useCaseItems(en, '## 🎓 Use cases', 'Ways of using this tool in particular');

// Size of a safelisted value as the core counts it toward the 1,024-byte total:
// add Accept values as padding until the total first exceeds 1,024 bytes.
function coreSafelistBytes(name, value) {
  assert.deepEqual(core.unsafeRequestHeaderNames([{ name, value }]), []);
  for (let padding = 0; padding <= 1024; padding += 1) {
    const entries = [{ name, value }];
    for (let left = padding; left > 0; left -= 128) {
      entries.push({ name: 'Accept', value: 'a'.repeat(Math.min(128, left)) });
    }
    if (core.unsafeRequestHeaderNames(entries).length) return 1025 - padding;
  }
  return 0;
}

// The largest value size the core still safelists for one header.
function coreValueLimit(name) {
  let size = 0;
  while (size < 4096 && core.isSafelistedHeader(name, 'a'.repeat(size + 1))) size += 1;
  return size;
}

// The simulator's JSON preset: the button label on each page, and whether the request it sets needs a
// preflight. The request is built as doSimulate builds it: header names with empty values, then Content-Type.
function jsonPreset() {
  const handler = read('js/cors-simulator.js')
    .match(/Q\('btnSimPresetJSON'\)\.addEventListener\('click', \(\)=>\{([\s\S]*?)\n\}\);/);
  assert.ok(handler, 'missing the btnSimPresetJSON handler');
  const value = (id) => {
    const match = handler[1].match(new RegExp(`Q\\('${id}'\\)\\.value = '([^']*)';`));
    assert.ok(match, `the JSON preset does not set ${id}`);
    return match[1];
  };
  const headers = value('simHeaders').split(',').map((name) => name.trim()).filter(Boolean)
    .map((name) => ({ name, value: '' }));
  if (value('simContentType')) headers.push({ name: 'Content-Type', value: value('simContentType') });
  const label = (page) => {
    const match = read(page).match(/<button id="btnSimPresetJSON"[^>]*>([^<]+)<\/button>/);
    assert.ok(match, `${page}: missing the btnSimPresetJSON button`);
    return match[1].trim();
  };
  return {
    preflight: core.needsPreflight(value('simMethod'), headers),
    jaLabel: label('index.html'),
    enLabel: label('index.en.html'),
  };
}

test('both READMEs open the use-case section with three uses specific to this tool', () => {
  const jaItems = jaUses();
  const enItems = enUses();
  assert.equal(jaItems.length, 3);
  assert.equal(enItems.length, jaItems.length);
  for (const item of jaItems) {
    assert.ok(item.endsWith('。'), item);
    assert.doesNotMatch(item, /分かる|無い|効く|走る|照合|既定|\*\*/u);
    assert.doesNotMatch(item, /[ぁ-んァ-ヶ一-龠] [A-Za-z0-9`]|[A-Za-z0-9`] [ぁ-んァ-ヶ一-龠]/u);
  }
  for (const item of enItems) {
    assert.ok(item.endsWith('.'), item);
    assert.doesNotMatch(item, /\*\*|[ぁ-んァ-ヶ一-龠]/u);
  }
});

test('numbers in the uses specific to this tool are recomputed from the core in both languages', () => {
  const [jaCache, jaRange, jaLocale] = jaUses();
  const [enCache, enRange, enLocale] = enUses();
  const has = (item, texts) => texts.forEach((text) => assert.ok(item.includes(text), text));

  // 1. Boundary values of the preflight cache model: Max-Age 600, a blank Max-Age, and 0,
  // for the request the JSON preset sets.
  const preset = jsonPreset();
  assert.equal(preset.preflight, true);
  const second = (maxAge, after) => core.modelPreflightCache({
    preflightRequired: preset.preflight, maxAge, secondRequestAfter: after,
  });
  let lastReuse = -1;
  for (let after = 0; after <= 700; after += 1) {
    if (second('600', after).reused) lastReuse = after;
  }
  const firstExpiry = lastReuse + 1;
  assert.equal(second('600', lastReuse).events[1].reason, 'cacheHit');
  assert.equal(second('600', firstExpiry).events[1].reason, 'expired');
  const blank = second('', 0);
  assert.equal(blank.maxAgeDefaulted, true);
  assert.equal(second('0', 0).events[1].reason, 'expired');
  has(jaCache, [
    `「${preset.jaLabel}」（プリフライトあり）`,
    'Access-Control-Max-Ageを600にすると', `${lastReuse}秒後なら再利用`, `${firstExpiry}秒ちょうどなら期限切れ`,
    `空欄にすると${blank.maxAge}秒として扱い`, '0にすると0秒後でも再利用しない',
  ]);
  has(enCache, [
    `"${preset.enLabel}" preset`,
    'Access-Control-Max-Age 600', `${lastReuse} seconds later reuses the cache`,
    `for one exactly ${firstExpiry} seconds later the cache has expired`, `treated as ${blank.maxAge} seconds`,
    '0 allows no reuse even 0 seconds later',
  ]);

  // 2. Range forms, and the response headers JavaScript can read without ACEH.
  const range = (value) => core.needsPreflight('GET', [{ name: 'Range', value }]);
  assert.equal(range('bytes=-65536'), range('bytes=0-99,200-299'));
  assert.notEqual(range('bytes=0-16383'), range('bytes=-65536'));
  const names = 'Content-Type, Content-Length, Content-Range, ETag';
  const hidden = core.responseHeaderExposure({ credentials: false, responseHeaders: names, exposeHeaders: '' });
  const listed = core.responseHeaderExposure({ credentials: false, responseHeaders: names, exposeHeaders: 'Content-Range' });
  const total = hidden.readable.length + hidden.unreadable.length;
  assert.deepEqual(hidden.unreadable.map((entry) => entry.name), ['Content-Range', 'ETag']);
  assert.ok(listed.readable.some((entry) => entry.name === 'Content-Range' && entry.reason === 'explicit'));
  has(jaRange, [
    '`Range: bytes=0-16383`', `\`preflight_estimated\`は${range('bytes=0-16383')}`, '`bytes=-65536`と',
    `\`bytes=0-99,200-299\`は${range('bytes=0-99,200-299')}`, `\`${names}\``,
    `${total}つのうち${hidden.readable.length}つ`, '`Content-Range`はACEHに書くまで読めない',
  ]);
  has(enRange, [
    '`Range: bytes=0-16383`', `\`preflight_estimated\` ${range('bytes=0-16383')}`, '`bytes=-65536` or',
    `\`bytes=0-99,200-299\` makes it ${range('bytes=0-99,200-299')}`, `\`${names}\``,
    `${hidden.readable.length} of the ${total}`, 'stays unreadable until it is listed in ACEH',
  ]);

  // 3. Language tags separated by hyphens, and locale names separated by underscores.
  // Replacing only `_` with `-` removes the preflight, so `_` alone is the cause.
  const tags = 'ja,en-US;q=0.9,en;q=0.8';
  const locales = ['ja_JP.UTF-8', 'ja_JP'];
  for (const name of ['Accept-Language', 'Content-Language']) {
    assert.equal(core.needsPreflight('GET', [{ name, value: tags }]), false);
    assert.equal(core.needsPreflight('GET', [{ name, value: 'ja-JP' }]), false);
    for (const locale of locales) {
      assert.equal(core.needsPreflight('GET', [{ name, value: locale }]), true, locale);
      assert.equal(core.needsPreflight('GET', [{ name, value: locale.replaceAll('_', '-') }]), false, locale);
    }
  }
  const bytes = coreSafelistBytes('Accept-Language', tags);
  const limit = coreValueLimit('Accept-Language');
  assert.equal(coreValueLimit('Content-Language'), limit);
  assert.ok(bytes <= limit);
  has(jaLocale, [
    `\`${tags}\`（${bytes}バイトで、1つの値の上限${limit}バイトに収まる）はプリフライトなし`,
    '`ja_JP.UTF-8`', '`ja_JP`は', '`_`がセーフリストで許される文字にないためプリフライトになる',
  ]);
  has(enLocale, [
    `\`${tags}\` (${bytes} bytes, within the ${limit}-byte limit for one value) goes without a preflight`,
    '`ja_JP.UTF-8`', '`ja_JP` need one', 'because `_` is not among the characters the safelist allows',
  ]);
});
