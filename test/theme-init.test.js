const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

// Runs js/theme-init.js in a fake window with the given saved value and OS setting,
// and returns whether <html> ends up with the dark class.
function run({ saved = null, prefersDark = false, storageThrows = false } = {}) {
  const classes = new Set();
  const window = {
    localStorage: { getItem: () => { if (storageThrows) throw new Error('blocked'); return saved; } },
    matchMedia: () => ({ matches: prefersDark }),
    document: { documentElement: { classList: { add: (name) => classes.add(name) } } },
  };
  vm.runInNewContext(read('js/theme-init.js'), { window });
  return classes.has('dark');
}

test('without a saved value the page stays light, whatever the OS setting', () => {
  assert.equal(run({ prefersDark: false }), false);
  assert.equal(run({ prefersDark: true }), false);
});

test('the saved value decides the theme', () => {
  assert.equal(run({ saved: 'dark' }), true);
  assert.equal(run({ saved: 'light', prefersDark: true }), false);
});

test('an unexpected saved value is ignored', () => {
  assert.equal(run({ saved: 'Dark' }), false);
  assert.equal(run({ saved: 'blue', prefersDark: true }), false);
});

test('a blocked localStorage does not throw and leaves the page light', () => {
  assert.equal(run({ storageThrows: true }), false);
});

test('both language pages load theme-init.js in <head>, after the stylesheet', () => {
  for (const file of ['index.html', 'index.en.html']) {
    const html = read(file);
    const head = html.slice(0, html.indexOf('</head>'));
    assert.ok(head.includes('<script src="js/theme-init.js"></script>'), `${file}: theme-init.js is not in <head>`);
    assert.ok(head.indexOf('css/style.css') < head.indexOf('js/theme-init.js'), file);
  }
});
