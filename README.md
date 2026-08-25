# willmalfeld.com — site guide

A static site, no build step required. Open `index.html` in a browser to preview it locally, or upload the whole folder to any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages all work for free).

## Files

```
index.html      About / resume (home page)
blog.html       Blog listing page
blog/           One HTML file per post
css/style.css   All styling
js/main.js      Scroll-reveal animation
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

## Add a new blog post

1. Duplicate `blog/what-mountains-taught-me-about-debugging.html` and rename it, e.g. `blog/my-new-post.html`.
2. Open the new file and update:
   - `<title>` and the `meta description`
   - the `eyebrow` category label (e.g. "Software", "Teaching", "Cycling")
   - the `<h1>` and `post-meta` line (put a real date here instead of "Example post")
   - the content inside `.post-content` — delete the italic placeholder note first
3. Open `blog.html` and duplicate one `<a class="post-card">...</a>` block, then update:
   - the `href` to point at your new file
   - the category, title, excerpt, and date text
   - the little SVG polyline colors if you want the thumbnail to look different (swap `stroke="#C1502E"` for `#3E6E8E` or `#B08D4F` to vary it)
4. Save, refresh `blog.html` in your browser — the new card should appear.

There's no database — the blog is just a list of static HTML files, which keeps it fast and easy to host anywhere.

## Edit your info

Everything in `index.html` (bio, experience, projects, education, skills, contact) is plain HTML — search for the text you want to change and edit it directly. Section order can be rearranged by moving the whole `<section>...</section>` blocks.

## Colors & type, if you want to adjust the look

All design tokens live at the top of `css/style.css` under `:root`. Change a hex value there and it updates everywhere:

- `--blaze` — the rust-orange accent (trail blaze)
- `--chalk` — the blue accent (teaching)
- `--contour` — the gold accent (elevation lines)
- `--ink` / `--mist` — text and background
