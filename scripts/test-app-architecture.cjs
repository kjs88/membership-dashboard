const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fail = message => { throw new Error(message); };

const html = read('index.html');
const scriptFiles = [...html.matchAll(/<script\s+[^>]*src="(js\/[^"]+)"/g)].map(match => match[1].split('?')[0]);
for (const file of scriptFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`Missing script referenced by index.html: ${file}`);
}

const requiredOrder = ['js/ui-utils.js', 'js/ui-feedback.js', 'js/app-data.js', 'js/main.js'];
for (let i = 1; i < requiredOrder.length; i++) {
  if (scriptFiles.indexOf(requiredOrder[i - 1]) >= scriptFiles.indexOf(requiredOrder[i])) {
    fail(`Invalid script order: ${requiredOrder[i - 1]} must load before ${requiredOrder[i]}`);
  }
}

const declarations = new Map();
for (const file of scriptFiles) {
  const source = read(file);
  for (const match of source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const locations = declarations.get(match[1]) || [];
    locations.push(file);
    declarations.set(match[1], locations);
  }
}
const duplicateFunctions = [...declarations.entries()].filter(([, files]) => files.length > 1);
if (duplicateFunctions.length) {
  fail(`Duplicate global functions: ${duplicateFunctions.map(([name, files]) => `${name} (${files.join(', ')})`).join('; ')}`);
}

if (/class="[^"]*"[^>]*\sclass="/i.test(html)) fail('index.html contains an element with duplicate class attributes.');
if (/function\s+loadAndRender\s*\(/.test(read('js/bootstrap-datepicker.js'))) {
  fail('bootstrap-datepicker.js must only own date-picker behavior.');
}
if (/function\s+(escHtml|escInlineJs|safeColor)\s*\(/.test(read('js/daily-entry.js'))) {
  fail('Shared escaping helpers must stay in ui-utils.js.');
}

const uiContext = vm.createContext({ testInput: `<a title="x">&'` });
vm.runInContext(read('js/ui-utils.js'), uiContext);
const escaped = vm.runInContext('escHtml(testInput)', uiContext);
if (escaped !== '&lt;a title=&quot;x&quot;&gt;&amp;&#39;') fail(`Unexpected escHtml result: ${escaped}`);
const color = vm.runInContext(`safeColor('red', '#123456')`, uiContext);
if (color !== '#123456') fail(`Unexpected safeColor fallback: ${color}`);

console.log(`PASS: ${scriptFiles.length} scripts, unique globals, module order, shared UI utilities`);
