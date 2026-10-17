// ============================================================
// Frontmatter + Markdown for the writing section.
// Deliberately small and dependency-free. It supports what essays
// need, plus ::: blocks for photography layouts (see
// content/writing/README.md for the full syntax).
// ============================================================

// ---------- escaping ----------
export const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escAttr = (s) => escText(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------- frontmatter (a small YAML subset) ----------
//   key: value          strings (quotes optional), true / false
//   key: [a, b, c]      inline lists
//   key:                block lists
//     - a
//     - b
export function parseFrontmatter(src, file = 'file') {
  const m = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) return { data: {}, body: src };
  const data = {};
  let listKey = null;
  m[1].split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || /^\s*#/.test(line)) return;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) { data[listKey].push(parseScalar(item[1])); return; }
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/.exec(line);
    if (!kv) throw new Error(`${file}: can't read frontmatter line ${i + 2}: "${line.trim()}"`);
    const [, key, raw] = kv;
    if (raw === '') { data[key] = []; listKey = key; return; }
    listKey = null;
    data[key] = /^\[.*\]$/.test(raw) ? splitList(raw.slice(1, -1)) : parseScalar(raw);
  });
  for (const k of Object.keys(data)) if (Array.isArray(data[k]) && !data[k].length) data[k] = '';
  return { data, body: src.slice(m[0].length) };
}

function splitList(s) {
  const out = [];
  let cur = '', q = null;
  for (const ch of s) {
    if (q) { if (ch === q) q = null; cur += ch; }
    else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(parseScalar).filter((v) => v !== '');
}

function parseScalar(raw) {
  const s = String(raw).trim();
  if (/^".*"$/.test(s)) { try { return JSON.parse(s); } catch { return s.slice(1, -1); } }
  if (/^'.*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
  if (s === 'true') return true;
  if (s === 'false') return false;
  return s;
}

// ---------- inline formatting ----------
const STASH = '\u0000';

function smartTypography(s) {
  return s
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\.\.\./g, '…')
    .replace(/(^|[\s(\[{—–])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s(\[{—–“])'/g, '$1‘')
    .replace(/'/g, '’');
}

export function inline(src) {
  const stash = [];
  const keep = (html) => `${STASH}${stash.push(html) - 1}${STASH}`;
  let s = String(src);

  s = s.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${escText(code)}</code>`));
  s = s.replace(/<(https?:\/\/[^>\s]+)>/g, (_, url) => keep(`<a href="${escAttr(url)}">${escText(url)}</a>`));
  s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g, (_, text, url, title) =>
    keep(`<a href="${escAttr(url)}"${title ? ` title="${escAttr(title)}"` : ''}>${inline(text)}</a>`));
  // a trailing backslash or two trailing spaces are a hard line break
  s = s.replace(/(\\| {2,})\n/g, () => keep('<br>'));

  s = smartTypography(escText(s));
  s = s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])\*(?=\S)([\s\S]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_(?=\S)([\s\S]*?\S)_(?!\w)/g, '$1<em>$2</em>');

  const restore = new RegExp(`${STASH}(\\d+)${STASH}`, 'g');
  while (s.includes(STASH)) s = s.replace(restore, (_, i) => stash[+i]);
  return s;
}

export const plainText = (s) => inline(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// ---------- block parser ----------
const IMG_LINE = /^!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+"([^"]*)")?\s*\)$/;
const UL_ITEM = /^[-*+]\s+(.*)$/;
const OL_ITEM = /^(\d+)[.)]\s+(.*)$/;
const HTML_BLOCK = /^<\/?(div|figure|iframe|video|audio|table|section|aside|details|summary|p|ul|ol|blockquote|hr|img|picture|dl|pre|h[2-6])\b/i;

/**
 * Render an article body.
 * ctx.image(src) -> { url, width, height, missing, full } for an image reference
 * ctx.warn(msg)
 * Returns { html, headings }.
 */
export function renderBody(src, ctx) {
  const state = { ctx, ids: new Set(), headings: [] };
  const html = renderBlocks(src.replace(/\r\n?/g, '\n').split('\n'), state);
  return { html, headings: state.headings };
}

function renderBlocks(lines, state) {
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join('\n'))}</p>`);
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { flush(); continue; }

    if (t.startsWith('```')) {
      flush();
      const lang = t.slice(3).trim();
      const buf = [];
      while (++i < lines.length && !/^```\s*$/.test(lines[i].trim())) buf.push(lines[i]);
      out.push(`<pre><code${lang ? ` class="language-${escAttr(lang)}"` : ''}>${escText(buf.join('\n'))}</code></pre>`);
      continue;
    }

    const dir = /^:::\s*([a-z-]+)\s*(.*)$/i.exec(t);
    if (dir) {
      flush();
      const buf = [];
      while (++i < lines.length && lines[i].trim() !== ':::') buf.push(lines[i]);
      if (i >= lines.length) state.ctx.warn(`"::: ${dir[1]}" block is never closed with ":::"`);
      out.push(directive(dir[1].toLowerCase(), dir[2].trim(), buf, state));
      continue;
    }

    const h = /^(#{1,4})\s+(.+?)\s*#*$/.exec(t);
    if (h) {
      flush();
      const level = Math.max(2, h[1].length);
      const text = plainText(h[2]);
      let id = slugify(text) || 'section';
      for (let n = 2; state.ids.has(id); n++) id = `${slugify(text)}-${n}`;
      state.ids.add(id);
      if (level === 2) state.headings.push({ id, text });
      out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out.push('<hr class="section-break">'); continue; }

    const img = IMG_LINE.exec(t);
    if (img && !para.length) { out.push(figure('text', [imageRef(img)], '', state)); continue; }

    if (t.startsWith('>')) {
      flush();
      const buf = [];
      for (; i < lines.length && lines[i].trim().startsWith('>'); i++) buf.push(lines[i].trim().replace(/^>\s?/, ''));
      i--;
      out.push(`<blockquote>${renderBlocks(buf, state)}</blockquote>`);
      continue;
    }

    if ((UL_ITEM.test(t) || OL_ITEM.test(t)) && !para.length) {
      const ordered = !UL_ITEM.test(t);
      const re = ordered ? OL_ITEM : UL_ITEM;
      const start = ordered ? +OL_ITEM.exec(t)[1] : 1;
      const items = [];
      for (; i < lines.length; i++) {
        const lt = lines[i].trim();
        const m = re.exec(lt);
        if (m) { items.push(ordered ? m[2] : m[1]); continue; }
        if (lt && !UL_ITEM.test(lt) && !OL_ITEM.test(lt)) { items[items.length - 1] += '\n' + lt; continue; }
        // a blank line ends the list unless the next line continues it
        if (!lt && i + 1 < lines.length && re.test(lines[i + 1].trim())) continue;
        break;
      }
      i--;
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }

    if (HTML_BLOCK.test(t) && !para.length) {
      const buf = [];
      for (; i < lines.length && lines[i].trim(); i++) buf.push(lines[i]);
      out.push(buf.join('\n'));
      continue;
    }

    para.push(t);
  }
  flush();
  return out.join('\n');
}

// ---------- images & figures ----------
function imageRef(m) {
  const [caption, credit] = (m[3] || '').split(/\s+\|\s+/);
  return { alt: m[1], src: m[2], caption: caption || '', credit: credit || '' };
}

function collectImages(lines, state, kind) {
  const imgs = [];
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    const m = IMG_LINE.exec(t);
    if (m) imgs.push(imageRef(m));
    else state.ctx.warn(`"::: ${kind}" ignores a line that isn't an image: "${t}"`);
  }
  return imgs;
}

function imgTag(ref, info, extra = '') {
  const dims = info.width && info.height ? ` width="${info.width}" height="${info.height}"` : '';
  return `<img src="${escAttr(info.url)}" alt="${escAttr(ref.alt)}"${dims} loading="lazy" decoding="async"${extra}>`;
}

function captionHtml(caption, credit) {
  if (!caption && !credit) return '';
  return `<figcaption>${caption ? `<span class="cap">${inline(caption)}</span>` : ''}${credit ? ` <span class="credit">${inline(credit)}</span>` : ''}</figcaption>`;
}

export function missingImage(ref, ratio = '3 / 2') {
  return `<div class="img-missing" role="img" aria-label="${escAttr(ref.alt || 'Image unavailable')}"${ratio ? ` style="aspect-ratio:${ratio}"` : ''}><span>${escText(ref.alt || 'Image unavailable')}</span></div>`;
}

// One image, framed + linked for the lightbox.
function frame(ref, state) {
  const info = state.ctx.image(ref.src);
  if (info.missing) return { html: missingImage(ref), info };
  const capAttr = [ref.caption, ref.credit].filter(Boolean).map(plainText).join(' — ');
  return {
    info,
    html: `<a class="fig-frame" href="${escAttr(info.full || info.url)}" data-lightbox${capAttr ? ` data-caption="${escAttr(capAttr)}"` : ''}>${imgTag(ref, info)}</a>`,
  };
}

function figure(kind, refs, groupCaption, state) {
  if (refs.length === 1 && !groupCaption) {
    const ref = refs[0];
    const { html, info } = frame(ref, state);
    const portrait = info.width && info.height && info.height > info.width * 1.05;
    return `<figure class="fig fig--${kind}${portrait && kind === 'text' ? ' fig--portrait' : ''}">${html}${captionHtml(ref.caption, ref.credit)}</figure>`;
  }
  // Multiple images (or a shared caption): justified rows, no cropping.
  const rows = kind === 'gallery' ? galleryRows(refs, state) : [refs];
  const rowHtml = rows.map((row) => `<div class="fig-row">${row.map((ref) => {
    const { html, info } = frame(ref, state);
    const ratio = info.width && info.height ? info.width / info.height : 1.5;
    return `<figure class="fig-cell" style="flex-grow:${ratio.toFixed(3)}">${html}${captionHtml(ref.caption, ref.credit)}</figure>`;
  }).join('')}</div>`).join('');
  return `<figure class="fig fig--${kind}">${rowHtml}${groupCaption ? captionHtml(groupCaption, '') : ''}</figure>`;
}

// Group gallery images into balanced rows: pick a row count from the total
// aspect ratio, then fill each row toward an even share of it.
const ROW_RATIO = 3;
function galleryRows(refs, state) {
  const ratios = refs.map((ref) => {
    const info = state.ctx.image(ref.src);
    return info.width && info.height ? info.width / info.height : 1.5;
  });
  const total = ratios.reduce((x, y) => x + y, 0);
  const target = total / Math.max(1, Math.round(total / ROW_RATIO));
  const rows = [];
  let row = [], sum = 0;
  refs.forEach((ref, i) => {
    const r = ratios[i];
    if (row.length && (Math.abs(sum + r - target) > Math.abs(sum - target) || row.length === 4)) {
      rows.push(row); row = []; sum = 0;
    }
    row.push(ref); sum += r;
  });
  if (row.length) rows.push(row);
  return rows;
}

// ---------- ::: directives ----------
function directive(name, arg, lines, state) {
  switch (name) {
    case 'wide':
    case 'full': {
      const imgs = collectImages(lines, state, name);
      if (imgs.length === 1) return figure(name, [{ ...imgs[0], caption: imgs[0].caption || arg }], '', state);
      return figure(name, imgs, arg, state);
    }
    case 'pair':
    case 'side-by-side':
      return figure('pair', collectImages(lines, state, name), arg, state);
    case 'gallery':
      return figure('gallery', collectImages(lines, state, name), arg, state);
    case 'pullquote':
    case 'quote': {
      const text = lines.map((l) => l.trim()).filter(Boolean);
      let cite = '';
      if (text.length > 1 && /^(—|--|-)\s*/.test(text[text.length - 1])) cite = text.pop().replace(/^(—|--|-)\s*/, '');
      return `<aside class="pullquote"><blockquote><p>${inline(text.join(' '))}</p></blockquote>${cite ? `<p class="pullquote-cite">${inline(cite)}</p>` : ''}</aside>`;
    }
    case 'video':
      return video(lines.map((l) => l.trim()).filter(Boolean), state);
    case 'note':
      return `<aside class="editor-note">${arg ? `<p class="editor-note-label">${inline(arg)}</p>` : ''}${renderBlocks(lines, state)}</aside>`;
    default:
      state.ctx.warn(`unknown block "::: ${name}" — rendering its contents as plain text`);
      return renderBlocks(lines, state);
  }
}

function video([url = '', ...captionLines], state) {
  const caption = captionLines.join(' ');
  let embed;
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  const title = escAttr(plainText(caption) || 'Embedded video');
  if (yt) embed = `<iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="${title}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  else if (vimeo) embed = `<iframe src="https://player.vimeo.com/video/${vimeo[1]}?dnt=1" title="${title}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  else if (/\.(mp4|webm|mov)$/i.test(url)) embed = `<video src="${escAttr(state.ctx.image(url).url)}" controls preload="metadata" playsinline></video>`;
  else { state.ctx.warn(`"::: video" needs a YouTube, Vimeo, or .mp4/.webm link — got "${url}"`); return ''; }
  return `<figure class="fig fig--wide fig--video"><div class="video-frame">${embed}</div>${captionHtml(caption, '')}</figure>`;
}

// ---------- word count ----------
export function countWords(body) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/^:::.*$/gm, ' ')
    .replace(/\]\([^)]*\)/g, ' ')
    .replace(/[#>*_`[\]|]/g, ' ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;
}
