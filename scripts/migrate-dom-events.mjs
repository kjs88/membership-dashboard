// One-time AST migration: move markup code into real callbacks, then remove raw HTML sinks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseExpression } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { parse as parseHtml } from 'parse5';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const print = node => generate(node, { comments: true, jsescOption: { minimal: true } }).code;
const placeholder = i => `__UI_SLOT_${i}__`;
const slotRe = /__UI_SLOT_(\d+)__/g;
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|quot|apos|amp|lt|gt);/gi, (_, key) => {
  if (key[0] === '#') return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)));
  return { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' }[key.toLowerCase()];
});
let eventCount = 0, sinkCount = 0;

function rawArgument(node, scope) {
  if (t.isCallExpression(node) && t.isIdentifier(node.callee) && ['escHtml', 'escInlineJs', 'esc'].includes(node.callee.name)) return node.arguments[0];
  if (t.isIdentifier(node)) {
    const binding = scope.getBinding(node.name);
    const init = binding?.path?.node?.init;
    if (init && t.isCallExpression(init) && t.isIdentifier(init.callee) && ['escHtml', 'escInlineJs', 'esc'].includes(init.callee.name)) return init.arguments[0];
  }
  if (t.isCallExpression(node) && t.isMemberExpression(node.callee) && node.callee.property.name === 'replace' && t.isRegExpLiteral(node.arguments[0]) && node.arguments[0].pattern === "'") return node.callee.object;
  return node;
}

function callback(code, expressions, scope) {
  const ast = parse(`(function(event, uiValues) { ${decode(code)} })`);
  const values = [];
  const slots = new Map();
  const valueAt = index => {
    if (!slots.has(index)) { slots.set(index, values.length); values.push(rawArgument(expressions[index], scope)); }
    return t.memberExpression(t.identifier('uiValues'), t.numericLiteral(slots.get(index)), true);
  };
  traverse(ast, {
    StringLiteral(p) {
      if (!/__UI_SLOT_\d+__/.test(p.node.value)) return;
      const parts = p.node.value.split(/(__UI_SLOT_\d+__)/).filter(Boolean).map(part => {
        const match = /^__UI_SLOT_(\d+)__$/.exec(part);
        return match ? t.callExpression(t.identifier('String'), [valueAt(Number(match[1]))]) : t.stringLiteral(part);
      });
      p.replaceWith(parts.reduce((a, b) => t.binaryExpression('+', a, b)));
      p.skip();
    },
    Identifier(p) {
      const match = /^__UI_SLOT_(\d+)__$/.exec(p.node.name);
      if (match) { p.replaceWith(valueAt(Number(match[1]))); p.skip(); }
    },
  });
  return { fn: ast.program.body[0].expression, values };
}

function transformMarkup(node, scope) {
  const expressions = t.isTemplateLiteral(node) ? [...node.expressions] : [];
  let text = t.isTemplateLiteral(node) ? node.quasis.map((q, i) => q.value.cooked + (i < node.expressions.length ? placeholder(i) : '')).join('') : node.value;
  if (!/\son[a-z]+\s*=/.test(text)) return null;
  let changed = false;
  text = text.replace(/\bon([a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (_, event, double, single) => {
    const { fn, values } = callback(double ?? single, expressions, scope);
    const call = t.callExpression(t.identifier('uiAction'), [t.stringLiteral(event.toLowerCase()), fn, t.arrayExpression(values)]);
    const slot = expressions.push(call) - 1;
    changed = true;
    eventCount++;
    return placeholder(slot);
  });
  if (!changed) throw new Error(`Unmatched event markup: ${text.slice(0, 180)}`);
  const quasis = [], outputExpressions = [];
  let start = 0;
  for (const match of text.matchAll(slotRe)) {
    const raw = text.slice(start, match.index);
    quasis.push(t.templateElement({ raw: raw.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'), cooked: raw }));
    outputExpressions.push(expressions[Number(match[1])]);
    start = match.index + match[0].length;
  }
  const last = text.slice(start);
  quasis.push(t.templateElement({ raw: last.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'), cooked: last }, true));
  return t.templateLiteral(quasis, outputExpressions);
}

for (const file of fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js') && name !== 'erp-data.js')) {
  if (['security-dom.js', 'ui-static-main.js', 'ui-static-project.js'].includes(file)) continue;
  const fullPath = path.join(root, 'js', file), source = fs.readFileSync(fullPath, 'utf8');
  const ast = parse(source);
  const replacements = [];
  traverse(ast, {
    'TemplateLiteral|StringLiteral': {
      exit(p) {
        const next = transformMarkup(p.node, p.scope);
        if (!next) return;
        const { start, end } = p.node;
        p.replaceWith(next);
        replacements.push({ start, end, node: next });
        p.skip();
      },
    },
    AssignmentExpression: {
      exit(p) {
        const left = p.node.left;
        if (!t.isMemberExpression(left) || left.computed || left.property.name !== 'innerHTML') return;
        if (p.node.operator !== '=') throw new Error(`Unsupported HTML assignment in ${file}`);
        const next = t.callExpression(t.identifier('uiSetHtml'), [left.object, p.node.right]);
        const { start, end } = p.node;
        p.replaceWith(next);
        replacements.push({ start, end, node: next });
        sinkCount++;
      },
    },
  });
  const outer = replacements.filter(item => !replacements.some(other => other !== item && other.start <= item.start && other.end >= item.end));
  let output = source;
  for (const item of outer.sort((a, b) => b.start - a.start)) output = output.slice(0, item.start) + print(item.node) + output.slice(item.end);
  if (replacements.length) fs.writeFileSync(fullPath, output);
}

for (const [htmlName, scriptName] of [['index.html', 'ui-static-main.js'], ['project-tracker.html', 'ui-static-project.js']]) {
  const fullPath = path.join(root, htmlName), source = fs.readFileSync(fullPath, 'utf8');
  const tree = parseHtml(source, { sourceCodeLocationInfo: true });
  const edits = [], bindings = [];
  function walk(node) {
    for (const attr of node.attrs || []) {
      if (!/^on[a-z]+$/.test(attr.name)) continue;
      const location = node.sourceCodeLocation.attrs[attr.name];
      const event = attr.name.slice(2), key = `s${bindings.length}`;
      const { fn } = callback(attr.value, [], null);
      bindings.push(`[${JSON.stringify(event)}, ${JSON.stringify(key)}, ${print(fn)}]`);
      edits.push({ start: location.startOffset, end: location.endOffset, text: `data-ui-static-${event}="${key}"` });
      eventCount++;
    }
    (node.childNodes || []).forEach(walk);
    if (node.content) walk(node.content);
  }
  walk(tree);
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  fs.writeFileSync(fullPath, output);
  fs.writeFileSync(path.join(root, 'js', scriptName), `// Static controls are bound once from trusted application code.\nuiBindStatic([\n${bindings.join(',\n')}\n]);\n`);
}
console.log(`Converted ${eventCount} inline handlers and ${sinkCount} HTML writes.`);
