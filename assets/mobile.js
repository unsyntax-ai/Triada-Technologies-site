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
    window.name = v === 'classic' ? 'triada-classic' : '';   // fallback for browsers that block sessionStorage
    location.replace(location.href);   // replaces the entry instead of adding history, and does not replay the home intro
  }
  Array.prototype.forEach.call(document.querySelectorAll('.view-switch'), function (b) { b.addEventListener('click', function () {
    var toApp = root.classList.contains('classic');   // the switch is ON in the app view; flipping it goes to the other view
    b.setAttribute('aria-checked', toApp ? 'true' : 'false');
    root.classList.toggle('flip');                      // lets the knob slide before the page reloads in the other view
    var go = function () { setView(toApp ? 'app' : 'classic'); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) go(); else setTimeout(go, 200);
  }); b.setAttribute('aria-checked', root.classList.contains('classic') ? 'false' : 'true'); });

  // mobile web view: the menu bar dissolves while the page moves up (reading down) and returns when you move back
  var lastY = window.scrollY, hidden = false;
  window.addEventListener('scroll', function () {
    if (!root.classList.contains('classic') || !phone.matches) return;
    var y = window.scrollY, d = y - lastY;
    if (y < 24) { hidden = false; }
    else if (d > 6) { hidden = true; }
    else if (d < -6) { hidden = false; }
    if (Math.abs(d) > 6 || y < 24) lastY = y;
    root.classList.toggle('menu-hide', hidden);
  }, { passive: true });

  // third bar (mobile web view): bring the current page's chip into view so the swipe row starts where you are
  var rail = document.querySelector('.menubar ul'), cur = rail && rail.querySelector('[aria-current]');
  if (cur) rail.scrollLeft = Math.max(0, cur.offsetLeft - (rail.clientWidth - cur.offsetWidth) / 2);

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
  // ----- App view only: a floating chat box that replaces the contact form. It asks one thing at a time, uses the same rules
  // and the same server function as the website's contact form, and ends with an envelope that folds and turns green.
  // Nothing here runs at desktop width or in the mobile web view. Add #chat-demo to the address to see the last screen without sending. -----
  var CHAT = {
    api: 'https://evofqeolhdlteyztrzin.supabase.co/functions/v1/contact', key: 'sb_publishable_GZfm9qny4LxQHdqBBeoSeQ_gkyqVTLj',
    phone: '+1 469 396 2108', phoneHref: 'tel:+14693962108', email: 'hr@triadatechnologies.com'
  };
  var chatBuilt = false;
  function buildChat() {
    var pg = here(location.pathname);
    if (chatBuilt || !active() || pg === 'contact.html' || pg === 'admin.html') return;   // the contact page already has the real form
    chatBuilt = true;
    var el = function (tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
    var noMotion = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
    var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

    // the same rules as the website's contact form
    var rules = {
      name: function (v) {
        if (!v) return 'Enter your name.';
        if (v.length < 2) return 'That name looks too short.';
        if (!/[A-Za-zÀ-ɏ]/.test(v)) return 'Your name should include letters.';
        return '';
      },
      email: function (v) {
        if (!v) return 'Enter your email address.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email address, like name@company.com.';
        return '';
      },
      phone: function (v) {
        if (!v) return '';
        if (!/^\+?[\d\s().-]+$/.test(v)) return 'Use digits, spaces and + ( ) - only, for example (814) 555-0123.';
        var d = v.replace(/\D/g, '');
        if (d.length < 10 || d.length > 15) return 'Enter the full phone number with area code, or skip.';
        return '';
      },
      message: function (v) {
        if (!v) return 'Write a short message so we know how to help.';
        if (v.length < 60) return 'Please add at least 60 characters so we can help.';
        if (v.length > 999) return 'Shorten your message to 999 characters or fewer.';
        return '';
      }
    };
    var steps = [
      { f: 'name', q: function () { return 'Hi! What is your first name?'; }, ph: 'First name', ac: 'given-name', max: 80 },
      { f: 'company', q: function (a) { return 'Nice to meet you, ' + esc(a.name) + '. Which company are you with?'; }, ph: 'Company name', ac: 'organization', max: 100, skip: true },
      { f: 'email', q: function () { return 'What is your email address?'; }, ph: 'name@company.com', ac: 'email', type: 'email', mode: 'email', max: 120 },
      { f: 'phone', q: function () { return 'And a phone number, if you would like a call?'; }, ph: '(814) 555-0123', ac: 'tel', type: 'tel', mode: 'tel', max: 30, skip: true },
      { f: 'reason', q: function () { return 'How can we help?'; }, choices: [['client', 'Hiring talent'], ['candidate', 'Looking for work'], ['vendor', 'Vendor or partner']] },
      { f: 'message', q: function () { return 'Tell us a little about it.'; }, area: true, max: 999 }
    ];
    var ans, at, openedAt;
    var reset = function () { ans = { name: '', company: '', email: '', phone: '', reason: '', message: '' }; at = 0; };
    reset();

    // ---- the floating button with the travelling neon border ----
    var fab = el('button', 'chat-fab', '<span class="cf-glow"></span><span class="cf-ring"></span><span class="cf-face"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6a.6.6 0 0 1-1-.46V16A2.5 2.5 0 0 1 4 13.5z"/><path d="M8.5 9.8h.01M12 9.8h.01M15.5 9.8h.01"/></svg></span>');
    fab.type = 'button'; fab.setAttribute('aria-label', 'Contact us: open the chat form'); fab.setAttribute('aria-haspopup', 'dialog');

    // ---- the popup ----
    var ov = el('div', 'chat-ov'); ov.hidden = true;
    var card = el('div', 'chat-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'chat-q');
    var xb = el('button', 'chat-x', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'); xb.type = 'button'; xb.setAttribute('aria-label', 'Close');
    var bk = el('button', 'chat-back', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>'); bk.type = 'button'; bk.setAttribute('aria-label', 'Previous question');
    var dots = el('div', 'chat-dots'); dots.setAttribute('aria-hidden', 'true');
    steps.forEach(function () { dots.appendChild(el('i')); });
    var stage = el('div', 'chat-stage');
    var done = el('div', 'chat-done'); done.hidden = true;
    card.appendChild(bk); card.appendChild(xb); card.appendChild(dots); card.appendChild(stage); card.appendChild(done);
    ov.appendChild(card);
    document.body.appendChild(fab); document.body.appendChild(ov);

    var render = function (dir) {
      var s = steps[at];
      Array.prototype.forEach.call(dots.children, function (d, i) { d.className = i < at ? 'is-done' : (i === at ? 'is-now' : ''); });
      bk.style.visibility = at ? 'visible' : 'hidden';
      var html = '<h2 id="chat-q" class="chat-q">' + s.q(ans) + '</h2>';
      if (s.choices) {
        html += '<div class="chat-choices">' + s.choices.map(function (c) { return '<button type="button" class="chat-choice" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>';
      } else {
        html += '<form class="chat-form" novalidate>';
        html += s.area
          ? '<textarea class="chat-in" name="v" maxlength="' + s.max + '" rows="5" placeholder="At least 60 characters, so we know how to help." aria-describedby="chat-err"></textarea><div class="chat-meta"><span class="chat-err" id="chat-err" role="alert"></span><span class="chat-count">0 / ' + s.max + '</span></div>'
          : '<input class="chat-in" name="v" type="' + (s.type || 'text') + '" ' + (s.mode ? 'inputmode="' + s.mode + '" ' : '') + 'autocomplete="' + s.ac + '" maxlength="' + s.max + '" placeholder="' + s.ph + '" aria-describedby="chat-err"><div class="chat-meta"><span class="chat-err" id="chat-err" role="alert"></span></div>';
        html += '<input class="chat-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">';   // bot trap, same idea as the website form
        html += '<div class="chat-btns">' + (s.skip ? '<button type="button" class="chat-skip">Skip</button>' : '') + '<button type="submit" class="chat-next">' + (s.area ? 'Send message' : 'Next') + '</button></div></form>';
      }
      stage.innerHTML = html;
      stage.className = 'chat-stage' + (dir ? ' in-' + dir : '');
      var form = stage.querySelector('form'), inp = stage.querySelector('.chat-in'), err = stage.querySelector('.chat-err');
      if (s.choices) {
        Array.prototype.forEach.call(stage.querySelectorAll('.chat-choice'), function (b) {
          if (ans.reason === b.getAttribute('data-v')) b.classList.add('is-on');
          b.addEventListener('click', function () { ans.reason = b.getAttribute('data-v'); go(1); });
        });
        return;
      }
      if (ans[s.f]) inp.value = ans[s.f];
      var counter = stage.querySelector('.chat-count');
      var count = function () { if (counter) { counter.textContent = inp.value.length + ' / ' + s.max; counter.classList.toggle('near', inp.value.length >= s.max * .9); } };
      var showErr = function (t) { err.textContent = t; inp.classList.toggle('bad', !!t); if (t) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid'); };
      inp.addEventListener('input', function () { if (inp.classList.contains('bad')) showErr(rules[s.f] && s.f !== 'company' ? rules[s.f](inp.value.trim()) : ''); count(); });
      count();
      var skip = stage.querySelector('.chat-skip');
      if (skip) skip.addEventListener('click', function () { ans[s.f] = ''; go(1); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = inp.value.trim(), t = rules[s.f] ? rules[s.f](v) : '';
        if (t) { showErr(t); inp.focus(); return; }
        ans[s.f] = v;
        if (s.area) send(form); else go(1);
      });
      if (!noMotion()) setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }, 260); else inp.focus();
    };
    var go = function (d) { at = Math.max(0, Math.min(steps.length - 1, at + d)); render(d > 0 ? 'next' : 'prev'); };
    bk.addEventListener('click', function () { var inp = stage.querySelector('.chat-in'); if (inp && steps[at].f !== 'reason') ans[steps[at].f] = inp.value.trim(); go(-1); });

    // ---- sending: the same function, the same fields and the same bot checks as the website's contact form ----
    var sending = false;
    var send = function (form) {
      if (sending) return; sending = true;
      var btn = form.querySelector('.chat-next'), err = form.querySelector('.chat-err'), inp = form.querySelector('.chat-in');
      btn.disabled = true; btn.textContent = 'Sending...'; err.textContent = '';
      var fail = function (t) { sending = false; btn.disabled = false; btn.textContent = 'Send message'; err.textContent = t; };
      var direct = ' Please try again, or email ' + CHAT.email + '.';
      var ok = function () { sending = false; finish(); };
      if (location.hash === '#chat-demo') { setTimeout(ok, 700); return; }   // preview of the last screen only; sends nothing
      fetch(CHAT.api, {
        method: 'POST',
        headers: { apikey: CHAT.key, 'Content-Type': 'application/json', 'x-region': 'us-east-1' },
        body: JSON.stringify({ name: ans.name, company: ans.company, email: ans.email, phone: ans.phone, reason: ans.reason || 'client',
                               message: ans.message, website: form.elements.website.value, t: Date.now() - openedAt })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
        .then(function (x) {
          if (x.r.ok && x.j.ok) { ok(); return; }
          if (x.r.status === 400 && x.j.fields) {
            var bad = Object.keys(x.j.fields)[0];
            if (bad === 'message') { fail(x.j.fields.message); inp.classList.add('bad'); return; }
            sending = false;
            var idx = steps.map(function (s) { return s.f; }).indexOf(bad);
            if (idx > -1) { at = idx; render('prev'); var e2 = stage.querySelector('.chat-err'); if (e2) e2.textContent = x.j.fields[bad]; } else fail('Please check your entries.');
          } else if (x.r.status === 429) fail('You have sent several messages already. Please try again later, or email ' + CHAT.email + '.');
          else fail('We could not send your message.' + direct);
        })
        .catch(function () { fail('We could not reach our server.' + direct); });
    };

    // ---- the envelope: the form folds into an envelope that turns green ----
    var finish = function () {
      stage.className = 'chat-stage is-out';
      dots.style.opacity = '0'; bk.style.visibility = 'hidden';
      done.innerHTML =
        '<div class="env" aria-hidden="true"><div class="env-back"></div><div class="env-letter"><i></i><i></i><i></i></div><div class="env-front"></div><div class="env-flap"></div>' +
        '<svg class="env-ok" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><path d="m12.5 20.5 5.2 5.2 9.8-10.6"/></svg></div>' +
        '<h2 class="chat-q" id="chat-q" tabindex="-1">Query sent</h2>' +
        '<p class="chat-sub">Thank you' + (ans.name ? ', ' + esc(ans.name) : '') + '. Our team will contact you within 24 hours. Or reach us directly:</p>' +
        '<div class="chat-direct"><a href="' + CHAT.phoneHref + '">' + CHAT.phone + '</a><a href="mailto:' + CHAT.email + '">' + CHAT.email + '</a></div>' +
        '<div class="chat-btns"><button type="button" class="chat-next chat-fin">Done</button></div>';
      var env = done.querySelector('.env');
      setTimeout(function () {
        stage.hidden = true; done.hidden = false; card.classList.add('is-done');
        void env.offsetWidth; env.classList.add(noMotion() ? 'is-final' : 'is-go');
        done.querySelector('.chat-fin').addEventListener('click', close);
        setTimeout(function () { var h = done.querySelector('h2'); if (h) h.focus({ preventScroll: true }); }, noMotion() ? 0 : 2000);
      }, noMotion() ? 0 : 240);
    };

    // ---- opening and closing: grows from the button like an app opening, and shrinks back into it ----
    var isOpen = false, lastFocus = null;
    var flight = function (toButton) {
      var a = fab.getBoundingClientRect(), c = card.getBoundingClientRect();
      var from = 'translate(' + (a.left + a.width / 2 - c.left - c.width / 2) + 'px,' + (a.top + a.height / 2 - c.top - c.height / 2) + 'px) scale(' + (a.width / c.width) + ',' + (a.height / c.height) + ')';
      var kf = [{ transform: from, opacity: 0 }, { transform: 'none', opacity: 1 }];
      return card.animate(toButton ? kf.slice().reverse() : kf, { duration: toButton ? 300 : 520, easing: toButton ? 'cubic-bezier(.4,0,.8,.4)' : 'cubic-bezier(.18,.9,.24,1.08)', fill: 'both' });
    };
    var open = function () {
      if (isOpen) return; isOpen = true; lastFocus = document.activeElement;
      if (done.hidden === false) { reset(); done.hidden = true; stage.hidden = false; card.classList.remove('is-done'); dots.style.opacity = ''; }
      openedAt = Date.now(); render();
      ov.hidden = false; root.classList.add('chat-open'); fab.classList.add('is-away');
      if (!noMotion()) { ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: 'both' }); flight(false); stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 160, fill: 'backwards' }); }
    };
    var close = function () {
      if (!isOpen) return; isOpen = false;
      var fin = function () { ov.hidden = true; root.classList.remove('chat-open'); fab.classList.remove('is-away'); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); };
      if (noMotion()) { fin(); return; }
      ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'both' });
      flight(true).onfinish = function () { fin(); card.getAnimations().forEach(function (an) { an.cancel(); }); ov.getAnimations().forEach(function (an) { an.cancel(); }); };
    };
    fab.addEventListener('click', open);
    xb.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {   // keep the focus inside the popup
        var f = Array.prototype.filter.call(card.querySelectorAll('button, input, textarea, a[href]'), function (n) { return !n.disabled && n.offsetParent !== null && n.tabIndex !== -1 && getComputedStyle(n).visibility !== 'hidden'; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // on-screen keyboard: keep the popup inside the visible part of the screen
    if (window.visualViewport) {
      var fit = function () { if (isOpen) { ov.style.height = window.visualViewport.height + 'px'; ov.style.top = window.visualViewport.offsetTop + 'px'; } };
      window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit);
    }
  }
  if (active()) buildChat();
  if (phone.addEventListener) phone.addEventListener('change', buildChat);
})();
