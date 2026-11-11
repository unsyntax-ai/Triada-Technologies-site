// Phone-only behavior. Loaded on every page but does nothing at desktop and tablet widths.
// It adds controls on top of the existing fields (they stay the source of truth) and never edits site.js or jobs.js.
(function () {
  var root = document.documentElement;
  var phone = window.matchMedia('(max-width: 700px)');
  var active = function () { return phone.matches && !root.classList.contains('classic'); };

  // ----- "Classic" / "App view" switch: remembered for this tab only (sessionStorage), nothing is stored after it closes.
  // Classic = the normal phone site without the app layer (same as before the app layer existed). A browser's own
  // "request desktop site" is separate: it makes the page wider than a phone, so the app layer stays off by itself. -----
  var KEY = 'triada-view';
  function setView(v) {
    try { if (v === 'classic') sessionStorage.setItem(KEY, 'classic'); else sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    location.replace(location.href);   // replaces the entry instead of adding history, and does not replay the home intro
  }
  Array.prototype.forEach.call(document.querySelectorAll('.view-switch'), function (b) { b.addEventListener('click', function () { setView('classic'); }); });
  Array.prototype.forEach.call(document.querySelectorAll('.classic-pill'), function (b) { b.addEventListener('click', function () { setView('app'); }); });

  // ----- tab bar: a liquid-glass lens glides from the selected tab to the one you tap, then the page changes.
  // Tapping the tab you are already on scrolls back to the top. Without animation support or with reduced motion
  // the lens just sits behind the selected tab and taps navigate straight away. -----
  var here = function (p) { var n = p.replace(/\/+$/, '').split('/').pop(); return n || 'index.html'; };
  var bar = document.querySelector('.tabbar');
  var reduced = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  if (bar) {
    var lens = document.createElement('span');
    lens.className = 'tab-lens'; lens.setAttribute('aria-hidden', 'true');
    bar.insertBefore(lens, bar.firstChild); bar.classList.add('has-lens');
    var tabs = Array.prototype.slice.call(bar.querySelectorAll('a'));
    var cur = bar.querySelector('a[aria-current]');
    var busy = false, goTimer = 0;
    var geom = function (a) { return { x: a.offsetLeft + 6, w: Math.max(0, a.offsetWidth - 12) }; };
    var place = function (a) {
      if (!a) { lens.style.display = 'none'; return; }
      var g = geom(a);
      lens.style.display = ''; lens.style.width = g.w + 'px'; lens.style.transform = 'translateX(' + g.x + 'px)';
    };
    var reset = function () {
      clearTimeout(goTimer); busy = false;
      bar.classList.remove('moving'); tabs.forEach(function (t) { t.classList.remove('is-target'); });
      lens.getAnimations && lens.getAnimations().forEach(function (an) { an.cancel(); });
      place(cur);
    };
    place(cur);
    window.addEventListener('resize', function () { if (!busy) place(cur); });
    window.addEventListener('orientationchange', function () { if (!busy) place(cur); });
    if (phone.addEventListener) phone.addEventListener('change', function () { if (!busy) place(cur); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) reset(); });   // back button: the page comes back as it was left

    var glide = function (from, to, done) {
      var f = geom(from), t = geom(to), dx = t.x - f.x, dir = dx < 0 ? -1 : 1;
      // squash and stretch: it lengthens while it travels, overshoots a touch, then settles
      var an = lens.animate([
        { transform: 'translateX(' + f.x + 'px) scale(1,1)', offset: 0, easing: 'cubic-bezier(.3,.6,.3,1)' },
        { transform: 'translateX(' + (f.x + dx * .55) + 'px) scale(1.2,.9)', offset: .45, easing: 'cubic-bezier(.3,.6,.3,1)' },
        { transform: 'translateX(' + (t.x + dir * 5) + 'px) scale(1.04,.98)', offset: .85, easing: 'ease-out' },
        { transform: 'translateX(' + t.x + 'px) scale(1,1)', offset: 1 }
      ], { duration: 440, fill: 'forwards' });
      an.onfinish = function () { place(to); an.cancel(); if (done) done(); };
    };

    tabs.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (!active() || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var samePage = here(a.pathname) === here(location.pathname);
        if (a === cur && samePage) {                       // the tab you are on: back to the top
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
          if (!reduced() && lens.animate) lens.animate([{ transform: lens.style.transform + ' scale(1,1)' }, { transform: lens.style.transform + ' scale(1.08,.94)' }, { transform: lens.style.transform + ' scale(1,1)' }], { duration: 260, easing: 'ease-out' });
          return;
        }
        if (a === cur || !cur || reduced() || !lens.animate || busy) return;   // a different page under the same tab, or no animation: plain navigation
        e.preventDefault(); busy = true;
        bar.classList.add('moving'); a.classList.add('is-target');
        glide(cur, a);
        goTimer = setTimeout(function () { location.href = a.href; }, 280);
      });
    });
  }

  // ----- the tab bar steps aside while a field has the on-screen keyboard -----
  document.addEventListener('focusin', function (e) { if (active() && e.target.matches('input, textarea, select')) root.classList.add('kbd'); });
  document.addEventListener('focusout', function () { root.classList.remove('kbd'); });

  // ----- Home: "I'm hiring / I want work" shows one card at a time -----
  var sw = document.querySelector('.side-switch'), duo = document.querySelector('.duo[data-side]');
  if (sw && duo) {
    sw.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      sw.dataset.side = duo.dataset.side = b.dataset.side;
      Array.prototype.forEach.call(sw.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  }

  // ----- controls built on top of existing fields -----
  function phoneUi() {
    if (!active()) return;
    // job type chips drive the existing "Type" select
    var ty = document.getElementById('jtype');
    if (ty && !document.querySelector('.chips')) {
      var chips = document.createElement('div');
      chips.className = 'chips'; chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Filter by type');
      Array.prototype.forEach.call(ty.options, function (o) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = o.value ? o.textContent : 'All'; b.dataset.v = o.value;
        b.setAttribute('aria-pressed', String(ty.value === o.value));
        chips.appendChild(b);
      });
      chips.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        ty.value = b.dataset.v; ty.dispatchEvent(new Event('change', { bubbles: true }));
        Array.prototype.forEach.call(chips.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      ty.closest('label').insertAdjacentElement('afterend', chips);
    }
    // contact "I am" select becomes a segmented control
    var reason = document.getElementById('reason');
    if (reason && !document.querySelector('.reason-seg')) {
      var seg = document.createElement('div');
      seg.className = 'reason-seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'I am');
      Array.prototype.forEach.call(reason.options, function (o) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = o.textContent; b.dataset.v = o.value;
        b.setAttribute('aria-pressed', String(reason.value === o.value));
        seg.appendChild(b);
      });
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        reason.value = b.dataset.v; reason.dispatchEvent(new Event('change', { bubbles: true }));
        Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      reason.closest('label').classList.add('has-seg');
      reason.insertAdjacentElement('afterend', seg);
    }
    // article thumbnails repeat the title link beside them and have no text: keep them out of the screen reader order
    Array.prototype.forEach.call(document.querySelectorAll('a.post-art'), function (a) { a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1; });
    // industry cards: tap to read the details
    Array.prototype.forEach.call(document.querySelectorAll('.industries .card'), function (c) {
      if (c.dataset.tile) return;
      c.dataset.tile = '1'; c.tabIndex = 0; c.setAttribute('role', 'button'); c.setAttribute('aria-expanded', 'false');
      var flip = function () { var o = c.classList.toggle('open'); c.setAttribute('aria-expanded', String(o)); };
      c.addEventListener('click', flip);
      c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    });
  }
  phoneUi();
  if (phone.addEventListener) phone.addEventListener('change', phoneUi);

  // ----- job page: sticky Apply / Call bar, built from the links jobs.js already renders -----
  var box = document.getElementById('job-detail');
  function jobBar() {
    if (!box || !active() || document.querySelector('.job-bar')) return;
    var mail = box.querySelector('a[href^="mailto:"]'), tel = box.querySelector('a[href^="tel:"]');
    if (!mail || !tel) return;
    var bar = document.createElement('div'); bar.className = 'job-bar';
    var call = document.createElement('a'); call.className = 'jb-call'; call.href = tel.getAttribute('href'); call.setAttribute('aria-label', 'Call ' + tel.textContent);
    call.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>';
    var apply = document.createElement('a'); apply.className = 'btn btn-solid'; apply.href = mail.getAttribute('href'); apply.textContent = 'Apply by email';
    bar.appendChild(call); bar.appendChild(apply); document.body.appendChild(bar);
  }
  if (box) {
    jobBar();
    if (window.MutationObserver) new MutationObserver(jobBar).observe(box, { childList: true, subtree: true });
  }
})();
