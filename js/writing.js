// Writing section enhancements. Everything here is optional: pages are fully
// readable without JavaScript.
(function () {
  'use strict';

  // ---------- broken images → a quiet placeholder instead of a broken icon ----------
  function replaceBroken(img) {
    if (img.dataset.broken) return;
    img.dataset.broken = '1';
    var box = document.createElement('div');
    box.className = 'img-missing';
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', img.alt || 'Image unavailable');
    box.textContent = img.alt || 'Image unavailable';
    var w = img.getAttribute('width'), h = img.getAttribute('height');
    if (w && h) box.style.aspectRatio = w + ' / ' + h;
    var frame = img.closest('.fig-frame');
    if (frame) frame.removeAttribute('data-lightbox');
    img.replaceWith(box);
  }
  document.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'IMG') replaceBroken(e.target);
  }, true);
  document.querySelectorAll('img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) replaceBroken(img);
  });

  // ---------- landing: topic filters + search ----------
  var grid = document.querySelector('[data-grid]');
  if (grid) setupFilters(grid);

  function setupFilters(grid) {
    var controls = document.querySelector('[data-controls]');
    var chips = Array.prototype.slice.call(document.querySelectorAll('.fn-filters .chip'));
    var input = document.getElementById('fn-q');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
    var featured = document.querySelector('.fn-featured');
    var empty = document.querySelector('[data-empty]');
    var emptyDesc = document.querySelector('[data-empty-desc]');
    var status = document.querySelector('.fn-status');
    var label = document.getElementById('collection-title');
    var defaultLabel = label.textContent;
    controls.hidden = false;

    var params = new URLSearchParams(location.search);
    var topic = params.get('topic') || '';
    if (!chips.some(function (c) { return c.dataset.topic === topic; })) topic = '';
    input.value = params.get('q') || '';

    function apply(updateUrl) {
      var q = input.value.trim().toLowerCase();
      var terms = q.split(/\s+/).filter(Boolean);
      var filtering = !!(topic || terms.length);
      var shown = 0;

      cards.forEach(function (card) {
        var isFeaturedCopy = card.hasAttribute('data-featured-copy');
        var match = (!topic || card.dataset.topic === topic) &&
          terms.every(function (t) { return card.dataset.search.indexOf(t) !== -1; });
        // The featured piece has its own slot; its grid copy only shows while filtering.
        var visible = filtering ? match : !isFeaturedCopy;
        card.hidden = !visible;
        if (visible) shown++;
      });

      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.topic === topic)); });
      if (featured) featured.hidden = filtering;
      empty.hidden = shown > 0;

      var activeChip = chips.filter(function (c) { return c.dataset.topic === topic; })[0];
      var topicName = topic && activeChip ? activeChip.firstChild.textContent.trim() : '';
      label.textContent = filtering ? (topicName || 'All writing') : defaultLabel;
      emptyDesc.textContent = [topicName && 'the topic “' + topicName + '”', q && '“' + input.value.trim() + '”'].filter(Boolean).join(' and ') || 'that search';
      status.textContent = filtering ? shown + (shown === 1 ? ' piece' : ' pieces') + ' shown' : '';

      if (updateUrl) {
        var p = new URLSearchParams();
        if (topic) p.set('topic', topic);
        if (q) p.set('q', input.value.trim());
        var qs = p.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
      }
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        topic = chip.dataset.topic;
        apply(true);
      });
    });
    input.addEventListener('input', function () { apply(true); });
    document.querySelector('[data-reset]').addEventListener('click', function () {
      topic = '';
      input.value = '';
      apply(true);
      chips[0].focus();
    });
    apply(false);
  }

  // ---------- article: accessible lightbox for photographs ----------
  var links = Array.prototype.slice.call(document.querySelectorAll('.prose a[data-lightbox]'));
  if (links.length && typeof HTMLDialogElement === 'function') setupLightbox(links);

  function setupLightbox(links) {
    var dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Photo viewer');
    dlg.innerHTML =
      '<figure class="lb-stage"><img class="lb-img" alt=""><figcaption class="lb-caption"></figcaption></figure>' +
      '<p class="lb-count" aria-live="polite"></p>' +
      '<button type="button" class="lb-btn lb-close" aria-label="Close photo viewer">' + icon('M6 6l12 12M18 6L6 18') + '</button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="Previous photo">' + icon('M15 5l-7 7 7 7') + '</button>' +
      '<button type="button" class="lb-btn lb-next" aria-label="Next photo">' + icon('M9 5l7 7-7 7') + '</button>';
    document.body.appendChild(dlg);

    var img = dlg.querySelector('.lb-img');
    var cap = dlg.querySelector('.lb-caption');
    var count = dlg.querySelector('.lb-count');
    var index = 0;
    var opener = null;
    var active = links;

    function show(i) {
      index = (i + active.length) % active.length;
      var link = active[index];
      var thumb = link.querySelector('img');
      img.src = link.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      cap.textContent = link.dataset.caption || '';
      count.textContent = (index + 1) + ' / ' + active.length;
    }

    function open(i, from) {
      // Re-read the list in case a broken image removed itself from the set.
      active = links.filter(function (l) { return l.hasAttribute('data-lightbox'); });
      opener = from;
      dlg.toggleAttribute('data-single', active.length < 2);
      show(active.indexOf(from) === -1 ? i : active.indexOf(from));
      dlg.showModal();
      document.body.classList.add('lb-open');
      dlg.querySelector('.lb-close').focus();
    }

    dlg.addEventListener('close', function () {
      document.body.classList.remove('lb-open');
      img.removeAttribute('src');
      if (opener) opener.focus();
    });

    links.forEach(function (link, i) {
      link.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let "open in new tab" work
        if (!link.hasAttribute('data-lightbox')) return;
        e.preventDefault();
        open(i, link);
      });
    });

    dlg.querySelector('.lb-close').addEventListener('click', function () { dlg.close(); });
    dlg.querySelector('.lb-prev').addEventListener('click', function () { show(index - 1); });
    dlg.querySelector('.lb-next').addEventListener('click', function () { show(index + 1); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });
    // Click on the dark background (not the photo or a button) closes.
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.classList.contains('lb-stage')) dlg.close();
    });

    var startX = null;
    dlg.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (startX === null || active.length < 2) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  function icon(d) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
})();
