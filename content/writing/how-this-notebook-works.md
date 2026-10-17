---
title: How This Notebook Works
subtitle: A demonstration of every layout this publication supports — photographs, galleries, pull quotes, and more.
excerpt: A working reference for the writing section — every kind of photograph, gallery, and text block an essay can use. Replace or unpublish it once real writing is in place.
date: 2026-09-10
category: Field Notes
tags: [example, photography, formatting]
status: published
cover: cover.svg
coverAlt: Placeholder landscape image in gold contour lines
coverCaption: The cover image sits at the top of the essay and on its card.
coverCredit: "Photo: Placeholder"
cardImages: [collage-1.svg, collage-2.svg]
card: wide
---

::: note Example
This piece demonstrates the formatting available in `content/writing/*.md`. Read its source file next to this page to see how each block is written. Set `status: draft` (or delete the file) when you no longer need it.
:::

Every essay is a single Markdown file with a short header of details — title, date, category, cover photo — followed by the writing itself. The first paragraph of the body, like this one, is set a little larger as a lede.

Plain paragraphs need nothing special. Words can be *emphasized*, made **strong**, or turned into [links](https://www.willmalfeld.com). Straight "quotes" become curly ones, two hyphens (`--`) become an en dash, and three (`---`) an em dash --- like this.

## Photographs in the text

A single image on its own line sits within the text column. The text in quotes becomes the caption; anything after a `|` becomes the photo credit.

![Placeholder landscape image in green tones](inline.svg "A photograph inside the text column. | Photo: Placeholder")

Portrait photographs are detected automatically and shown a little narrower, so they don't fill an entire phone screen.

![Placeholder portrait image in rust tones](portrait.svg "A portrait photograph, centered and narrower.")

## Wide and full-width photographs

Wrap an image in `::: wide` to let it extend past the text on larger screens.

::: wide
![Placeholder panoramic image in blue tones](wide.svg "A wide image, good for landscapes. | Photo: Placeholder")
:::

Or use `::: full` for an immersive, edge-to-edge photograph.

::: full
![Placeholder panoramic image on a dark background](full.svg "A full-width image spans the whole window.")
:::

## Side by side

`::: pair` places two (or three) images in a row. Their heights line up automatically, whatever their shapes, and nothing gets cropped.

::: pair Two images sharing one caption, written after the word "pair".
![Placeholder portrait image in gold tones](pair-1.svg)
![Placeholder portrait image in green tones](pair-2.svg)
:::

## Galleries

`::: gallery` takes any number of photographs, arranges them in balanced rows, and opens them in a full-screen viewer when clicked. Use the arrow keys to move through them and Escape to close.

::: gallery A gallery of six images with mixed shapes.
![Placeholder landscape image in blue tones](gallery-1.svg "Each image can have its own caption.")
![Placeholder portrait image in gold tones](gallery-2.svg)
![Placeholder square image in green tones](gallery-3.svg)
![Placeholder wide image in rust tones](gallery-4.svg "Captions appear in the viewer too.")
![Placeholder portrait image on a dark background](gallery-5.svg)
![Placeholder landscape image in gold tones](gallery-6.svg)
:::

## Quotes

A line starting with `>` is a regular quotation, set inside the text:

> A block quote is for quoting someone else at length, or for setting a passage apart from the surrounding text.

A pull quote lifts one line out of the essay and gives it room. An optional last line starting with a dash becomes the attribution.

::: pullquote
Pull quotes are for the one sentence a skimming reader should not miss.
— Optional attribution
:::

## Lists, dividers, and code

- Bulleted lists use a dash at the start of each line
- Numbered lists use `1.`, `2.`, and so on
- Keep items short

1. First
2. Second
3. Third

Three hyphens on their own line make a section break:

---

Code can be shown inline, like `npm run build`, or as a block:

```js
const reading = words / 230; // minutes
```

## Video

`::: video` embeds a YouTube or Vimeo link (using their privacy-friendly players), or plays a video file from the article's folder. Lines after the link become the caption.

```
::: video
https://www.youtube.com/watch?v=VIDEO_ID
Caption for the video.
:::
```

That's everything. The full guide, including how to add photographs and publish, lives in `content/writing/README.md`.
