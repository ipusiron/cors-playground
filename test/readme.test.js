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
  }
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
