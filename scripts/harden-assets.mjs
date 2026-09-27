import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libraries = [
  ['purify-3.4.16.min.js', 'https://raw.githubusercontent.com/cure53/DOMPurify/3.4.16/dist/purify.min.js'],
  ['chart-4.4.1.umd.js', 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'],
  ['xlsx-0.20.3.min.js', 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'],
].map(([file, source]) => ({ file, source, integrity: 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(path.join(root, 'vendor', file))).digest('base64') }));
fs.writeFileSync(path.join(root, 'vendor', 'manifest.json'), JSON.stringify(libraries, null, 2) + '\n');
const script = file => {
  const asset = libraries.find(item => item.file === file);
  return `<script src="vendor/${asset.file}" integrity="${asset.integrity}" crossorigin="anonymous"></script>`;
};
for (const name of ['index.html', 'project-tracker.html']) {
  const file = path.join(root, name);
  let html = fs.readFileSync(file, 'utf8');
  const project = name.startsWith('project-');
  const csp = "default-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'" + (project ? '' : ' https://membership-7aef2-default-rtdb.firebaseio.com') + "; frame-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests";
  html = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]+/, '$1' + csp);
  html = html.replace(/<meta http-equiv="X-Content-Type-Options" content="nosniff">\s*/, '');
  html = html.replace(/<script src="https:\/\/cdnjs[^>]+><\/script>\s*/g, '');
  const assets = [script('purify-3.4.16.min.js'), '<script src="js/security-dom.js?v=20260927-security"></script>'];
  if (!project) assets.push(script('chart-4.4.1.umd.js'), script('xlsx-0.20.3.min.js'));
  html = html.replace('</head>', assets.join('\n') + '\n</head>');
  html = html.replace(/(src="(?:js\/[^"?]+|project-tracker.html))\?[^"\s]+/g, '$1?v=20260927-security');
  const binder = `<script src="js/ui-static-${project ? 'project' : 'main'}.js?v=20260927-security"></script>`;
  html = project ? html.replace('</body>', binder + '\n</body>') : html.replace(/(<script src="js\/main.js[^>]+><\/script>)/, binder + '\n$1');
  fs.writeFileSync(file, html);
}
console.log('Pinned local assets and strict script policy installed.');
