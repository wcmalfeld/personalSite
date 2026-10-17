# willmalfeld.com — site guide

A static site hosted on GitHub Pages. The homepage is hand-written HTML. The writing section (`/writing/`) is generated from Markdown by a small, dependency-free Node script, and the generated pages are committed, so hosting needs no build step.

## Files

```
index.html          About / resume (home page): edit directly
content/writing/    Essays as Markdown + config.json. See content/writing/README.md
assets/writing/     Photos for each essay, one folder per essay
writing/            GENERATED essay pages, RSS feed: don't edit
sitemap.xml, robots.txt, 404.html, blog.html, blog/   GENERATED (blog URLs redirect to /writing/)
scripts/writing/    The build script
css/style.css       Site-wide styling + design tokens
css/writing.css     Writing-section styling
js/main.js          Homepage scroll-reveal
js/writing.js       Writing filters, search, photo viewer
tests/              `npm test`
```

## Writing

The full guide is in **[content/writing/README.md](content/writing/README.md)**. Short version:

```sh
nvm use 20          # Node 18+ needed
npm run dev         # preview at http://localhost:4000/writing/
npm run build       # regenerate pages after editing content
npm run check       # verify build is current + no broken links
npm test
```

## Add your photo

Currently the hero uses a circular "WM" placeholder (`.portrait` in `index.html`) instead of a real photo.

1. Drop your image into the `assets/` folder, e.g. `assets/will.jpg`.
2. In `index.html`, find:
   ```html
   <div class="portrait" aria-hidden="true">WM</div>
   ```
   Replace it with:
   ```html
   <img class="portrait" src="assets/will.jpg" alt="Will Malfeld">
   ```
3. If the photo isn't square, add `style="object-fit:cover;"` to the `<img>` tag so it fills the circle cleanly.

## Edit your info

Everything in `index.html` (bio, experience, projects, education, skills, contact) is plain HTML — search for the text you want to change and edit it directly. Section order can be rearranged by moving the whole `<section>...</section>` blocks.

## Colors & type, if you want to adjust the look

All design tokens live at the top of `css/style.css` under `:root`. Change a hex value there and it updates everywhere:

- `--blaze` — the rust-orange accent (trail blaze)
- `--chalk` — the blue accent (teaching)
- `--contour` — the gold accent (elevation lines)
- `--ink` / `--mist` — text and background

The writing section adds a warmer paper background and the Newsreader serif for long-form reading. Those live in `css/writing.css` under `body.fn`.
