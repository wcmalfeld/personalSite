// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter, inline, renderBody } from '../scripts/writing/markdown.mjs';
import { imageSize } from '../scripts/writing/images.mjs';
import { loadSite, buildFiles } from '../scripts/writing/site.mjs';

const ctx = (sizes = {}) => ({
  image: (src) => (sizes[src] === null ? { missing: true, url: src } : { url: src, ...(sizes[src] || { width: 1500, height: 1000 }) }),
  warn: () => {},
});

// A throwaway site with its own content folder.
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'writing-'));
  mkdirSync(join(root, 'content/writing'), { recursive: true });
  copyFileSync(new URL('../content/writing/config.json', import.meta.url), join(root, 'content/writing/config.json'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}
const post = (fm, body = 'Hello world.') => `---\n${fm}\n---\n\n${body}\n`;
const BASE = 'title: A Piece\nexcerpt: Short.\ndate: 2026-05-01\ncategory: Field Notes\nstatus: published';

test('frontmatter: scalars, quotes, booleans, inline and block lists, comments', () => {
  const { data, body } = parseFrontmatter(`---
# a comment
title: "Quoted: with colon"
other: 'it''s'
featured: true
tags: [one, "two, three", four]
cardImages:
  - a.jpg
  - b.jpg
empty:
---
Body`);
  assert.equal(data.title, 'Quoted: with colon');
  assert.equal(data.other, "it's");
  assert.equal(data.featured, true);
  assert.deepEqual(data.tags, ['one', 'two, three', 'four']);
  assert.deepEqual(data.cardImages, ['a.jpg', 'b.jpg']);
  assert.equal(data.empty, '');
  assert.equal(body, 'Body');
});

test('inline: emphasis, links, code, escaping, typography', () => {
  assert.equal(inline('**bold** and *em* and _em_'), '<strong>bold</strong> and <em>em</em> and <em>em</em>');
  assert.equal(inline('[a *b*](https://x.com/a_b_c)'), '<a href="https://x.com/a_b_c">a <em>b</em></a>');
  assert.equal(inline('`<tag> -- "x"`'), '<code>&lt;tag&gt; -- "x"</code>');
  assert.equal(inline('<script>'), '&lt;script&gt;');
  assert.equal(inline('"Hi," she said -- it\'s 5 --- done...'), '“Hi,” she said – it’s 5 — done…');
  assert.equal(inline('snake_case_name'), 'snake_case_name');
});

test('blocks: headings get unique ids, lists, quotes, rules', () => {
  const { html, headings } = renderBody('## Start\n\n## Start\n\n- a\n- b\n\n1. x\n2. y\n\n> quoted\n\n---\n\nend', ctx());
  assert.match(html, /<h2 id="start">Start<\/h2>/);
  assert.match(html, /<h2 id="start-2">/);
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(html, /<ol><li>x<\/li><li>y<\/li><\/ol>/);
  assert.match(html, /<blockquote><p>quoted<\/p><\/blockquote>/);
  assert.match(html, /<hr class="section-break">/);
  assert.equal(headings.length, 2);
});

test('figures: caption + credit, portrait detection, wide/full, pair, gallery rows', () => {
  const sizes = { 'p.jpg': { width: 800, height: 1200 } };
  const { html } = renderBody([
    '![Alt text](a.jpg "A caption | Photo: Someone")',
    '',
    '![Tall](p.jpg)',
    '',
    '::: wide', '![W](w.jpg)', ':::',
    '',
    '::: full Fallback caption', '![F](f.jpg)', ':::',
    '',
    '::: pair Shared', '![1](1.jpg)', '![2](2.jpg)', ':::',
    '',
    '::: gallery', '![g1](g1.jpg)', '![g2](g2.jpg)', '![g3](g3.jpg)', '![g4](g4.jpg)', ':::',
  ].join('\n'), ctx(sizes));
  assert.match(html, /alt="Alt text" width="1500" height="1000" loading="lazy"/);
  assert.match(html, /<span class="cap">A caption<\/span> <span class="credit">Photo: Someone<\/span>/);
  assert.match(html, /fig--text fig--portrait/);
  assert.match(html, /class="fig fig--wide"/);
  assert.match(html, /class="fig fig--full">.*Fallback caption/);
  assert.match(html, /class="fig fig--pair"><div class="fig-row">.*Shared/);
  assert.equal((html.match(/class="fig fig--gallery"/g) || []).length, 1);
  assert.equal((html.split('fig--gallery')[1].match(/class="fig-row"/g) || []).length, 2, '4 landscape images → 2 rows');
});

test('figures: a missing image renders a labelled placeholder', () => {
  const { html } = renderBody('![A river at dusk](gone.jpg)', ctx({ 'gone.jpg': null }));
  assert.match(html, /class="img-missing" role="img" aria-label="A river at dusk"/);
  assert.doesNotMatch(html, /<img/);
});

test('pull quotes, notes, and video embeds', () => {
  const { html } = renderBody('::: pullquote\nSay it once.\n— Someone\n:::\n\n::: video\nhttps://youtu.be/abc123XYZ\nA ride.\n:::', ctx());
  assert.match(html, /<aside class="pullquote"><blockquote><p>Say it once.<\/p><\/blockquote><p class="pullquote-cite">Someone<\/p><\/aside>/);
  assert.match(html, /youtube-nocookie\.com\/embed\/abc123XYZ/);
});

test('image sizes: PNG, JPEG, and rotated phone JPEG', () => {
  const dir = mkdtempSync(join(tmpdir(), 'img-'));
  const png = Buffer.alloc(32);
  png.writeUInt32BE(0x89504e47, 0); png.writeUInt32BE(640, 16); png.writeUInt32BE(480, 20);
  writeFileSync(join(dir, 'a.png'), png);
  assert.deepEqual(imageSize(join(dir, 'a.png')), { width: 640, height: 480 });

  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x00, 0x04, 0x00, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // 1024 wide, 768 tall
  writeFileSync(join(dir, 'a.jpg'), Buffer.concat([Buffer.from([0xff, 0xd8]), sof]));
  assert.deepEqual(imageSize(join(dir, 'a.jpg')), { width: 1024, height: 768 });

  // APP1 Exif segment with Orientation = 6 (rotate 90°)
  const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([0, tiff.length + 8]), Buffer.from('Exif\0\0', 'binary'), tiff]);
  writeFileSync(join(dir, 'b.jpg'), Buffer.concat([Buffer.from([0xff, 0xd8]), app1, sof]));
  assert.deepEqual(imageSize(join(dir, 'b.jpg')), { width: 768, height: 1024 });
});

test('site: drafts stay out of the build, slugs come from file names', () => {
  const root = fixture({
    'content/writing/live-one.md': post(`${BASE}\ntitle: Changed Title Later`),
    'content/writing/not-yet.md': post(BASE.replace('published', 'draft')),
    'content/writing/no-status.md': post(BASE.replace('\nstatus: published', '')),
    'content/drafts/private.md': post(BASE),
    'content/writing/_template.md': post(BASE),
  });
  const live = loadSite({ root });
  assert.deepEqual(live.errors, []);
  assert.deepEqual(live.articles.map((x) => x.slug), ['live-one']);
  assert.ok(live.warnings.some((w) => w.includes('no-status.md') && w.includes('draft')));

  const files = buildFiles(live);
  assert.ok(files.has('writing/live-one/index.html'));
  assert.ok(!files.has('writing/not-yet/index.html'));
  assert.doesNotMatch(files.get('writing/feed.xml'), /not-yet|private/);
  assert.doesNotMatch(files.get('sitemap.xml'), /not-yet|private/);

  const preview = loadSite({ root, includeDrafts: true });
  assert.deepEqual(preview.articles.map((x) => x.slug).sort(), ['live-one', 'no-status', 'not-yet', 'private']);
  assert.match(buildFiles(preview).get('writing/private/index.html'), /Draft preview/);
});

test('site: invalid metadata is reported clearly', () => {
  const root = fixture({
    'content/writing/bad.md': post('title: X\ndate: May 1\ncategory: Nope\nstatus: published\ncard: giant'),
    'content/writing/Bad Name.md': post(BASE),
  });
  const { errors } = loadSite({ root });
  assert.ok(errors.some((e) => e.includes('"date"')));
  assert.ok(errors.some((e) => e.includes('category "Nope"')));
  assert.ok(errors.some((e) => e.includes('card "giant"')));
  assert.ok(errors.some((e) => e.includes('slug "Bad Name"')));
});

test('site: featured, redirects, reading time, related', () => {
  const words = Array(700).fill('word').join(' ');
  const root = fixture({
    'content/writing/a.md': post(`${BASE}\ndate: 2026-01-01\nfeatured: true\naliases: [old/a.html]`, words),
    'content/writing/b.md': post(`${BASE}\ndate: 2026-02-01`),
    'content/writing/c.md': post(`${BASE}\ndate: 2026-03-01\ncategory: Lessons Learned`),
  });
  const site = loadSite({ root });
  assert.equal(site.articles[0].slug, 'c', 'newest first');
  assert.equal(site.articles.find((x) => x.slug === 'a').readingMinutes, 3);
  const files = buildFiles(site);
  const landing = files.get('writing/index.html');
  assert.match(landing.split('fn-collection')[0], /id="featured-title"><a href="a\/">/);
  assert.match(files.get('old/a.html'), /url=\.\.\/writing\/a\//);
  assert.match(files.get('blog.html'), /url=writing\//);
  const related = files.get('writing/b/index.html').split('Keep reading')[1];
  assert.ok(related.indexOf('writing/a/') < related.indexOf('writing/c/'), 'same-topic pieces come first');
});
