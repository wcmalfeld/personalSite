# Writing — how to publish

Every essay is one Markdown file in this folder. Its photos go in `assets/writing/<slug>/`. A small build script turns them into the pages under `/writing/`. It has no dependencies; it just needs Node 18 or newer (`nvm use 20`).

```
content/writing/
  config.json                 publication title, intro, categories, contact links
  _template.md                copy this to start a new piece (ignored by the build)
  my-essay.md                 → www.willmalfeld.com/writing/my-essay/
assets/writing/
  my-essay/
    cover.jpg
    photo-01.jpg
content/drafts/               optional, git-ignored: private drafts that never get committed
writing/                      GENERATED — don't edit by hand
```

## The everyday loop

```sh
npm run dev      # preview at http://localhost:4000/writing/ — drafts included, refresh to see edits
npm run build    # regenerate writing/, sitemap.xml, feed, 404 page, redirects
npm run check    # confirm everything is built and no internal links are broken
git add -A && git commit -m "New essay: …" && git push    # GitHub Pages publishes it
```

(`npm run x` is the same as `node scripts/writing/build.mjs x` if npm misbehaves.)

## Add a new piece

1. Copy `_template.md` to `content/writing/your-slug.md`. The file name becomes the URL, so use lowercase words and hyphens. Changing the title later never changes the URL. To change the URL on purpose, rename the file and add the old address to `aliases` so old links keep working.
2. Fill in the header (between the `---` lines):

   | Field | Required | Notes |
   |---|---|---|
   | `title` | yes | |
   | `date` | yes | `2026-10-16` |
   | `category` | yes | must match a name in `config.json` |
   | `status` | yes | `published` or `draft`. Anything else counts as a draft. |
   | `excerpt` | recommended | 1–2 sentences for cards, previews, and search engines |
   | `subtitle` | | shown under the title |
   | `tags` | | `[teaching, physics]`. Searchable, and listed at the end of the piece. |
   | `cover`, `coverAlt` | | cover photo + a description of it for screen readers |
   | `coverCaption`, `coverCredit` | | shown under the cover on the article page |
   | `coverPosition` | | crop focus on cards, e.g. `50% 30%` (x y) |
   | `featured` | | `true` puts it in the big slot at the top (newest featured piece wins) |
   | `readLabel` | | link text on the featured slot (default "Read the essay") |
   | `card` | | `standard`, `wide`, `tall`, `photo` (full-width photograph), or `text`. Picked automatically if omitted. |
   | `cardImages` | | `[photo-02.jpg, photo-03.jpg]`: extra photos for a collage on `wide`/`photo` cards |
   | `updated` | | date of a meaningful revision |
   | `seoTitle`, `seoDescription` | | override what search engines and link previews show |
   | `shareImage` | | a different image for link previews (JPG/PNG) |
   | `aliases` | | old URLs that should redirect here |

3. Write the body in Markdown below the header. Reading time is calculated automatically.

## Photographs

Put the files in `assets/writing/<slug>/`. Inside an essay, refer to them by file name alone (`photo-01.jpg`), or by a full path from the site root (`assets/…`).

**Preparing photos:** export JPGs at about **2400px on the long edge**, quality around 80 (typically 300–700 KB). The build warns about anything over 1.5 MB. Phone photos are fine; sideways EXIF rotation is handled. Width and height are read automatically, so pages don't jump while images load.

**Alt text** (inside `![…]`) describes the photo for people who can't see it. **Captions** go in quotes. Anything after ` | ` is the credit.

```md
![Alt text describing the photo](photo-01.jpg "Caption text | Photo: Name")
```

| Layout | Write it like this |
|---|---|
| In the text column | an image on its own line (portraits are automatically narrower) |
| Wide, past the text | `::: wide` → image → `:::` |
| Edge to edge | `::: full` → image → `:::` |
| Side by side | `::: pair Optional shared caption` → 2–3 images → `:::` |
| Gallery | `::: gallery Optional caption` → any number of images → `:::` |

```md
::: gallery Three days on the coast.
![Surf at dawn](coast-01.jpg "First light.")
![A rider on a ridge](coast-02.jpg)
![Tents in fog](coast-03.jpg)
:::
```

Galleries and pairs keep every photo uncropped and line up their heights. Clicking any photo opens a full-screen viewer (arrow keys or swipe to move through it, Esc to close). If a photo is missing, the build prints a warning and the page shows a quiet placeholder with the alt text instead of a broken image.

**Replacing a photo:** overwrite the file with the same name, or change the name in the Markdown. **Reordering:** move the lines. Then rebuild.

## Other blocks

```md
## Section heading
### Subheading

*emphasis*, **strong**, [a link](https://example.com), `code`

- bullet list
1. numbered list

> A quotation set inside the text.

::: pullquote
The one line a skimming reader shouldn't miss.
— Optional attribution
:::

---            (three hyphens: a section break)

::: video
https://www.youtube.com/watch?v=VIDEO_ID
Optional caption.
:::

::: note Label
A boxed editor's note.
:::
```

Video works with YouTube (privacy-enhanced player), Vimeo, or an `.mp4`/`.webm` file in the article's folder. Raw HTML on its own lines passes straight through, for anything unusual. See `how-this-notebook-works.md` for a working example of every block.

## Drafts, publishing, unpublishing

- **Draft:** `status: draft`. It shows in `npm run dev` (with a draft banner) but is never built, and it stays out of the sitemap and RSS feed.
- **Publish:** change to `status: published`, `npm run build`, commit, push.
- **Unpublish:** set it back to `draft` (or delete the file), rebuild, and push. The build clears out its page.
- **Private drafts:** the GitHub repository is public, so draft *source files* in `content/writing/` can be read there. For anything you don't want public yet, keep it in `content/drafts/`. That folder is git-ignored and shows only in the local preview.

## Categories and intro copy

Edit `config.json`. Categories show up as filters only once at least one published piece uses them. Renaming a category means updating the `category:` line in the pieces that use it; the build lists any mismatches.

## When something goes wrong

The build stops with a clear message naming the file and field (a bad date, an unknown category, a duplicate slug), and it warns about missing images or alt text. GitHub runs `npm run check` on every push (`.github/workflows/writing.yml`) and flags a commit if you forgot to rebuild. If you change the build scripts themselves, restart `npm run dev`.
