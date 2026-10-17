// Load + validate content/writing/*.md and assemble every generated file
// in memory as a Map of { "repo/relative/path": contents }.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseFrontmatter, renderBody, countWords, plainText, slugify } from './markdown.mjs';
import { imageSize } from './images.mjs';
import * as tpl from './templates.mjs';

const CARD_VARIANTS = ['standard', 'wide', 'tall', 'photo', 'text'];
const WORDS_PER_MINUTE = 230;
const LARGE_IMAGE_BYTES = 1.5 * 1024 * 1024;

export function loadSite({ root, includeDrafts = false }) {
  const warnings = [];
  const errors = [];
  const config = JSON.parse(readFileSync(join(root, 'content/writing/config.json'), 'utf8'));

  const categories = config.categories.map((c) => ({ name: c.name, slug: c.slug || slugify(c.name), description: c.description || '' }));
  const imageCache = new Map();

  // Resolve an image reference to { path | external, width, height, missing }.
  // Bare names ("cover.jpg", "trip/01.jpg") live in assets/writing/<slug>/;
  // "assets/..." or "/..." are paths from the site root.
  function resolveImage(src, slug, where) {
    if (/^https?:\/\//.test(src)) return { external: src };
    const path = src.startsWith('/') ? src.slice(1)
      : src.startsWith('assets/') ? src
      : `assets/writing/${slug}/${src.replace(/^\.\//, '')}`;
    if (!imageCache.has(path)) {
      const file = join(root, path);
      if (!existsSync(file)) {
        imageCache.set(path, { path, missing: true });
      } else {
        const size = imageSize(file);
        if (!size && !/\.(mp4|webm|mov)$/i.test(path)) warnings.push(`${where}: couldn't read the size of ${path} (use .jpg, .png, .webp, .gif or .svg)`);
        if (statSync(file).size > LARGE_IMAGE_BYTES) warnings.push(`${where}: ${path} is ${(statSync(file).size / 1048576).toFixed(1)} MB — export it at ~2400px on the long edge to keep pages fast`);
        imageCache.set(path, { path, ...(size || {}) });
      }
    }
    const img = imageCache.get(path);
    if (img.missing) warnings.push(`${where}: image not found: ${path}`);
    return img;
  }

  const sources = [];
  const dir = join(root, 'content/writing');
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md') sources.push({ file: join(dir, f), forceDraft: false });
  }
  // content/drafts/ is git-ignored: work in progress that never leaves your computer.
  const draftsDir = join(root, 'content/drafts');
  if (existsSync(draftsDir)) {
    for (const f of readdirSync(draftsDir)) if (f.endsWith('.md') && !f.startsWith('_')) sources.push({ file: join(draftsDir, f), forceDraft: true });
  }

  const articles = [];
  const slugs = new Map();
  for (const { file, forceDraft } of sources) {
    const rel = file.slice(root.length + 1);
    let parsed;
    try {
      parsed = parseFrontmatter(readFileSync(file, 'utf8'), rel);
    } catch (e) {
      errors.push(e.message);
      continue;
    }
    const { data: d, body } = parsed;
    const problems = [];
    const status = String(d.status || (d.draft === true ? 'draft' : '')).toLowerCase();
    if (!['draft', 'published'].includes(status)) {
      warnings.push(`${rel}: no "status: published" — treating it as a draft`);
    }
    const draft = forceDraft || status !== 'published';
    if (draft && !includeDrafts) continue;

    const slug = String(d.slug || basename(file, '.md'));
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) problems.push(`slug "${slug}" must be lowercase letters, numbers, and hyphens (it becomes the URL)`);
    if (slugs.has(slug)) problems.push(`slug "${slug}" is already used by ${slugs.get(slug)}`);
    slugs.set(slug, rel);

    if (!d.title) problems.push('missing "title"');
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d.date || ''));
    const date = dateMatch ? new Date(Date.UTC(+dateMatch[1], +dateMatch[2] - 1, +dateMatch[3])) : null;
    if (!date || isNaN(date)) problems.push(`"date" must look like 2026-10-16 (got "${d.date || ''}")`);
    const updatedMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d.updated || ''));
    const updated = updatedMatch ? new Date(Date.UTC(+updatedMatch[1], +updatedMatch[2] - 1, +updatedMatch[3])) : null;

    const catKey = String(d.category || '').toLowerCase();
    const category = categories.find((c) => c.name.toLowerCase() === catKey || c.slug === catKey);
    if (!category) problems.push(`category "${d.category || ''}" isn't in content/writing/config.json — use one of: ${categories.map((c) => c.name).join(', ')}`);

    const card = String(d.card || '').toLowerCase();
    if (card && !CARD_VARIANTS.includes(card)) problems.push(`card "${card}" should be one of: ${CARD_VARIANTS.join(', ')}`);

    if (problems.length) {
      errors.push(...problems.map((p) => `${rel}: ${p}`));
      continue;
    }

    const where = rel;
    const rendered = renderBody(body, {
      image: (src) => {
        const img = resolveImage(src, slug, where);
        return { ...img, url: tpl.imgUrl(img, '../../') };
      },
      warn: (msg) => warnings.push(`${where}: ${msg}`),
    });

    let excerpt = d.excerpt ? String(d.excerpt) : '';
    if (!excerpt) {
      const firstPara = body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^(#|!\[|:::|>|[-*+] |\d+\.)/.test(p)) || '';
      const text = plainText(firstPara.replace(/\s+/g, ' '));
      excerpt = text.length > 180 ? `${text.slice(0, 177).replace(/\s+\S*$/, '')}…` : text;
      warnings.push(`${rel}: no "excerpt" — using the opening lines`);
    }

    const cover = d.cover ? resolveImage(String(d.cover), slug, `${rel} (cover)`) : null;
    if (cover && !d.coverAlt) warnings.push(`${rel}: add "coverAlt" describing the cover photo for screen readers`);
    const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter(Boolean);
    const cardImages = list(d.cardImages).map((src) => resolveImage(src, slug, `${rel} (cardImages)`)).filter((img) => !img.missing);

    const portraitCover = cover && cover.height > cover.width;
    const variant = card || (!cover ? 'text' : cardImages.length ? 'wide' : portraitCover ? 'tall' : 'standard');

    articles.push({
      file: rel,
      slug,
      draft,
      title: String(d.title),
      subtitle: d.subtitle ? String(d.subtitle) : '',
      excerpt,
      date,
      updated,
      category,
      tags: list(d.tags),
      featured: d.featured === true,
      author: d.author ? String(d.author) : config.author,
      cover,
      coverAlt: String(d.coverAlt || d.title),
      coverCaption: d.coverCaption ? String(d.coverCaption) : '',
      coverCredit: d.coverCredit ? String(d.coverCredit) : '',
      coverPosition: d.coverPosition ? String(d.coverPosition) : '',
      cardImages,
      card: variant,
      shareImage: d.shareImage ? resolveImage(String(d.shareImage), slug, `${rel} (shareImage)`) : null,
      seoTitle: String(d.seoTitle || d.title),
      seoDescription: String(d.seoDescription || excerpt),
      aliases: list(d.aliases),
      readingMinutes: Math.max(1, Math.round(countWords(body) / WORDS_PER_MINUTE)),
      html: rendered.html,
    });
  }

  articles.sort((x, y) => y.date - x.date || x.title.localeCompare(y.title));

  const site = {
    ...config,
    categories,
    shareImage: resolveImage(config.defaultShareImage, '', 'config.json (defaultShareImage)'),
    year: Math.max(2026, ...articles.map((x) => x.date.getUTCFullYear())),
  };
  return { root, site, articles, warnings: [...new Set(warnings)], errors };
}

export function relatedTo(article, articles, n = 3) {
  return articles
    .filter((x) => x !== article)
    .map((x) => ({
      x,
      score: (x.category.slug === article.category.slug ? 3 : 0) + x.tags.filter((tag) => article.tags.includes(tag)).length,
    }))
    .sort((p, q) => q.score - p.score || q.x.date - p.x.date)
    .slice(0, n)
    .map((p) => p.x);
}

const RECENT = /(<!-- recent-writing:start -->)[\s\S]*?(<!-- recent-writing:end -->)/;

export function buildFiles({ root, site, articles }) {
  // `articles` only contains drafts in the local preview, where they're shown with a Draft flag.
  const files = new Map();
  const published = articles.filter((x) => !x.draft);

  files.set('writing/index.html', tpl.landingPage(site, articles));
  for (const article of articles) {
    files.set(`writing/${article.slug}/index.html`, tpl.articlePage(site, article, relatedTo(article, articles)));
  }
  files.set('writing/feed.xml', tpl.feed(site, published));
  // The homepage is hand-written; only the block between its recent-writing markers is generated.
  const home = root && existsSync(join(root, 'index.html')) ? readFileSync(join(root, 'index.html'), 'utf8') : '';
  if (RECENT.test(home)) files.set('index.html', home.replace(RECENT, (_, start, end) => `${start}\n${tpl.homeRecent(site, published)}\n${end}`));
  files.set('sitemap.xml', tpl.sitemap(site, published));
  files.set('robots.txt', tpl.robots(site));
  files.set('404.html', tpl.notFoundPage(site));

  const redirects = { ...site.redirects };
  for (const article of published) for (const alias of article.aliases) redirects[alias.replace(/^\//, '')] = `writing/${article.slug}/`;
  for (const [from, to] of Object.entries(redirects)) {
    files.set(from.endsWith('/') ? `${from}index.html` : from, tpl.redirectPage(site, from.endsWith('/') ? `${from}index.html` : from, to));
  }
  return files;
}
