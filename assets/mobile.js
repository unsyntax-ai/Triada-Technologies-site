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

  // ----- tab bar: a liquid-glass lens flows from the selected tab to the one you tap. The glide starts on the page you tap
  // and CONTINUES on the next page (the start time is passed along for a moment), so it reads as one movement, not a jump.
  // Its leading edge runs ahead and the trailing edge follows, so it stretches like a drop. Tapping the tab you are on
  // scrolls to the top. With reduced motion (or no animation support) taps simply navigate. -----
  var here = function (p) { var n = p.replace(/\/+$/, '').split('/').pop(); return n || 'index.html'; };
  var bar = document.querySelector('.tabbar');
  var reduced = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  if (bar) {
    var lens = bar.querySelector('.tab-lens');
    var tabs = Array.prototype.slice.call(bar.querySelectorAll('a'));
    var curIdx = 0, KEYL = 'triada-lens', DUR = 520;
    tabs.forEach(function (t, i) { if (t.hasAttribute('aria-current')) curIdx = i; });
    var edges = function (i) { var t = tabs[i]; return { l: t.offsetLeft + 1, r: t.offsetLeft + t.offsetWidth - 1 }; };
    var bez = function (x1, y1, x2, y2) {   // CSS cubic-bezier as a function of time, for building the two edge paths
      var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
      var X = function (t) { return ((ax * t + bx) * t + cx) * t; }, Y = function (t) { return ((ay * t + by) * t + cy) * t; };
      var dX = function (t) { return (3 * ax * t + 2 * bx) * t + cx; };
      return function (x) {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        var t = x;
        for (var i = 0; i < 8; i++) { var e = X(t) - x; if (Math.abs(e) < 1e-5) break; var d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
        return Y(t);
      };
    };
    var lead = bez(.12, .85, .25, 1.14), trail = bez(.42, 0, .2, 1);
    var glide = function (from, to, elapsed) {
      if (!lens || !lens.animate || from === to) return null;
      var A = edges(from), B = edges(to), right = B.l > A.l, N = 30, frames = [];
      for (var i = 0; i <= N; i++) {
        var t = i / N, fast = lead(t), slow = trail(Math.max(0, (t - .1) / .9));
        var l = A.l + (B.l - A.l) * (right ? slow : fast);
        var r = A.r + (B.r - A.r) * (right ? fast : slow);
        l = Math.max(3, l); r = Math.min(bar.clientWidth - 3, r);   // the overshoot never pokes past the screen edge
        frames.push({ left: l + 'px', width: Math.max(8, r - l) + 'px', transform: 'scaleY(' + (1 - .07 * Math.sin(Math.PI * t)).toFixed(3) + ')', offset: t });
      }
      var an = lens.animate(frames, { duration: DUR, easing: 'linear', fill: 'both' });
      if (elapsed) an.currentTime = elapsed;
      an.onfinish = function () { an.cancel(); };   // hands the lens back to the CSS resting position, which is the same spot
      return an;
    };
    var settle = function () {
      bar.classList.remove('moving');
      tabs.forEach(function (t) { t.classList.remove('is-target'); });
      if (lens && lens.getAnimations) lens.getAnimations().forEach(function (an) { an.cancel(); });
      try { sessionStorage.removeItem(KEYL); } catch (e) { /* ignore */ }
    };

    // arriving from another tab: pick the glide up where the previous page left it
    try {
      var rec = JSON.parse(sessionStorage.getItem(KEYL) || 'null');
      sessionStorage.removeItem(KEYL);
      if (rec && !reduced() && rec.t === curIdx) {
        var el = Date.now() - rec.t0;
        if (el >= 0 && el < DUR - 40) glide(rec.f, rec.t, el);
      }
    } catch (e) { /* ignore */ }
    root.classList.remove('lens-wait');
    window.addEventListener('pageshow', function (e) { if (e.persisted) settle(); });   // back button: the page comes back as it was left

    tabs.forEach(function (a, idx) {
      a.addEventListener('click', function (e) {
        if (!active() || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var samePage = here(a.pathname) === here(location.pathname);
        if (idx === curIdx && samePage) {                       // the tab you are on: back to the top
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
          if (!reduced() && lens && lens.animate) lens.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1.08,.94)' }, { transform: 'scale(1,1)' }], { duration: 260, easing: 'ease-out' });
          return;
        }
        if (idx === curIdx || reduced() || !lens || !lens.animate) return;   // same tab on another page, or no animation: plain navigation
        try { sessionStorage.setItem(KEYL, JSON.stringify({ f: curIdx, t: idx, t0: Date.now() })); } catch (err) { return; }
        bar.classList.add('moving');
        a.classList.add('is-target');
        glide(curIdx, idx, 0);       // starts now; the link then navigates normally and the next page continues it
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
