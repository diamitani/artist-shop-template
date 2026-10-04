/* Link checker for the artist shop static build. Pure Node, no dependencies.
 * Usage: node scripts/check-links.js [distDir]
 * Walks every .html file, resolves href/src attributes, and fails on dead links.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DIST = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
let checked = 0;
let failures = [];

function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.html')) out.push(p);
  }
}

function resolveLink(fromFile, href) {
  // external or fragment-only or special schemes: skip
  if (/^(https?:)?\/\//i.test(href)) return null;
  if (/^(mailto|tel|sms):/i.test(href)) return null;
  if (/^(data|blob|javascript):/i.test(href)) return null;
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  let target;
  if (clean.startsWith('/')) target = path.join(DIST, clean);
  else target = path.resolve(path.dirname(fromFile), clean);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
  }
  return target;
}

const files = [];
walk(DIST, files);

const attrRe = /(?:href|src)="([^"]+)"/g;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  let m;
  attrRe.lastIndex = 0;
  while ((m = attrRe.exec(html)) !== null) {
    const href = m[1];
    if (!href || href.startsWith('{{')) continue;
    const target = resolveLink(file, href);
    if (!target) continue;
    checked++;
    if (!fs.existsSync(target)) {
      failures.push(path.relative(DIST, file) + ' -> ' + href);
    }
  }
}

// every artwork page must reference an image that exists
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/catalog.json'), 'utf8'));
for (const a of catalog.artworks) {
  checked++;
  const page = path.join(DIST, 'works', a.id, 'index.html');
  const img = path.join(DIST, 'art', a.image);
  const thumb = path.join(DIST, 'art', 'thumbs', a.image);
  if (!fs.existsSync(page)) failures.push('missing artwork page: ' + a.id);
  if (!fs.existsSync(img)) failures.push('missing artwork image: ' + a.image);
  if (!fs.existsSync(thumb)) failures.push('missing artwork thumb: ' + a.image);
}
for (const e of catalog.exhibits) {
  checked++;
  if (!fs.existsSync(path.join(DIST, 'exhibits', e.id, 'index.html'))) {
    failures.push('missing exhibit page: ' + e.id);
  }
}

console.log('Checked ' + checked + ' links across ' + files.length + ' pages.');
if (failures.length) {
  console.log('DEAD LINKS (' + failures.length + '):');
  failures.forEach(function (f) { console.log('  ' + f); });
  process.exit(1);
} else {
  console.log('All links alive.');
}
