#!/usr/bin/env node
// Writing section build tool. No dependencies; needs Node 18+.
//
//   node scripts/writing/build.mjs          build the site (writes writing/, sitemap.xml, feed, 404, redirects)
//   node scripts/writing/build.mjs serve    local preview at http://localhost:4000 (includes drafts, rebuilds on refresh)
//   node scripts/writing/build.mjs check    verify generated files are up to date and every internal link resolves
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSite, buildFiles } from './site.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const command = process.argv[2] || 'build';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`Node 18 or newer is required (you have ${process.version}). Try: nvm use 20`);
  process.exit(1);
}

function generate({ includeDrafts }) {
  const result = loadSite({ root: ROOT, includeDrafts });
  for (const w of result.warnings) console.warn(`  warning  ${w}`);
  if (result.errors.length) {
    for (const e of result.errors) console.error(`  error    ${e}`);
    const err = new Error(`${result.errors.length} problem(s) in content/writing — fix them and run again.`);
    err.content = true;
    throw err;
  }
  return { ...result, files: buildFiles(result) };
}

function build() {
  const { articles, files } = generate({ includeDrafts: false });
  // writing/ is entirely generated, so clear it to drop pages for deleted or unpublished pieces.
  rmSync(join(ROOT, 'writing'), { recursive: true, force: true });
  for (const [path, contents] of files) {
    const out = join(ROOT, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, contents);
  }
  console.log(`Built ${articles.length} published piece(s) → writing/ (+ sitemap.xml, robots.txt, 404.html, feed.xml, ${files.size - articles.length - 5} redirect(s))`);
}

// ---------- link checking ----------
function checkLinks(files) {
  const exists = (p) => files.has(p) || (existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isFile());
  const broken = [];
  const pages = [...files.keys()].filter((p) => p.endsWith('.html'));
  pages.push('index.html');
  for (const page of pages) {
    const html = files.get(page) ?? readFileSync(join(ROOT, page), 'utf8');
    if (/http-equiv="refresh"/.test(html)) continue;
    for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      let url = m[1].replace(/&amp;/g, '&');
      if (/^(https?:|mailto:|tel:|data:|#)/.test(url)) continue;
      url = url.split(/[?#]/)[0];
      if (!url) continue;
      let target = url.startsWith('/') ? url.slice(1) : normalize(join(dirname(page), decodeURIComponent(url)));
      if (target === '.' || target.endsWith('/') || url.endsWith('/')) target = join(target, 'index.html');
      if (!exists(target)) broken.push(`${page} → ${m[1]}`);
    }
  }
  return broken;
}

function check() {
  const { files } = generate({ includeDrafts: false });
  const stale = [...files].filter(([path, contents]) => {
    const file = join(ROOT, path);
    return !existsSync(file) || readFileSync(file, 'utf8') !== contents;
  }).map(([path]) => path);
  const broken = checkLinks(files);
  for (const p of stale) console.error(`  stale    ${p}`);
  for (const b of broken) console.error(`  broken   ${b}`);
  if (stale.length) console.error('Generated files are out of date — run: node scripts/writing/build.mjs');
  if (stale.length || broken.length) process.exit(1);
  console.log(`OK — ${files.size} generated files up to date, no broken internal links.`);
}

// ---------- local preview server ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

function serve() {
  const port = Number(process.env.PORT) || 4000;
  let files = new Map();
  let lastWarnings = '';
  const rebuild = () => {
    // Rebuild on every page load so edits show up on refresh. Drafts are included here only.
    const result = loadSite({ root: ROOT, includeDrafts: true });
    const report = [...result.warnings.map((w) => `  warning  ${w}`), ...result.errors.map((e) => `  error    ${e}`)].join('\n');
    if (report !== lastWarnings) { if (report) console.warn(report); lastWarnings = report; }
    if (result.errors.length) throw new Error(result.errors.join('\n'));
    files = buildFiles(result);
  };

  createServer((req, res) => {
    let path = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    try {
      if (!extname(path) || /\.(html|xml)$/.test(path)) rebuild();
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`Content problems:\n\n${e.message}`);
      return;
    }
    const isDir = (p) => files.has(`${p}/index.html`) || (existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isDirectory());
    if (path && !path.endsWith('/') && !extname(path) && isDir(path)) {
      res.writeHead(301, { location: `/${path}/` });
      res.end();
      return;
    }
    if (path === '' || path.endsWith('/')) path += 'index.html';
    const file = join(ROOT, path);
    let body = files.get(path);
    if (body === undefined && file.startsWith(ROOT + '/') && existsSync(file) && statSync(file).isFile()) body = readFileSync(file);
    if (body === undefined) {
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      res.end(files.get('404.html'));
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  }).listen(port, () => {
    console.log(`Previewing at http://localhost:${port}/writing/  (drafts included — Ctrl+C to stop)`);
  });
}

try {
  if (command === 'build') build();
  else if (command === 'check') check();
  else if (command === 'serve') serve();
  else {
    console.error(`Unknown command "${command}". Use: build | serve | check`);
    process.exit(1);
  }
} catch (e) {
  console.error(e.content ? e.message : e);
  process.exit(1);
}
