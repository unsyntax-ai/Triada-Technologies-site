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
    var edges = function (i) { var t = tabs[i]; return { l: t.offsetLeft - 3, r: t.offsetLeft + t.offsetWidth + 3 }; };
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
  // ----- App view only: a floating chat box that stands in for the contact form. It talks like a messaging app: the team asks
  // one question at a time, the visitor answers in the composer, and a check mark confirms at the end. Same rules and same
  // server function as the website's contact form. All motion is CSS; this script only adds and removes classes.
  // Nothing here runs at desktop width or in the mobile web view. -----
  var CHAT = {
    api: 'https://evofqeolhdlteyztrzin.supabase.co/functions/v1/contact', key: 'sb_publishable_GZfm9qny4LxQHdqBBeoSeQ_gkyqVTLj',
    phone: '+1 469 396 2108', phoneHref: 'tel:+14693962108', email: 'hr@triadatechnologies.com',
    bypass: true   // TEMPORARY: skips the server and just shows the confirmation. Set to false once the contact function is deployed.
  };
  var chatBuilt = false;
  function buildChat() {
    var pg = here(location.pathname);
    if (chatBuilt || !active() || pg === 'contact.html' || pg === 'admin.html') return;   // the contact page already has the real form
    chatBuilt = true;
    var el = function (tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
    var calm = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var later = function (fn, ms) { return setTimeout(fn, calm() ? 0 : ms); };
    var MARK = '<img src="assets/favicon-192.png" width="40" height="40" alt="">';

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
        if (!/^\+?[\d\s().-]+$/.test(v)) return 'Use digits, spaces and + ( ) - only.';
        var d = v.replace(/\D/g, '');
        if (d.length < 10 || d.length > 15) return 'Enter the full number with area code, or tap Skip.';
        return '';
      },
      message: function (v) {
        if (!v) return 'Write a short message so we know how to help.';
        if (v.length < 60) return 'Add ' + (60 - v.length) + ' more characters so we can help.';
        if (v.length > 999) return 'Shorten your message to 999 characters or fewer.';
        return '';
      }
    };
    var steps = [
      { f: 'name', say: function () { return ['Hi, thanks for reaching out to Triada Technologies.', 'What is your first name?']; }, ph: 'First name', ac: 'given-name', max: 80 },
      { f: 'company', say: function (a) { return ['Nice to meet you, ' + a.name + '. Which company are you with?']; }, ph: 'Company', ac: 'organization', max: 100, skip: true },
      { f: 'email', say: function () { return ['What is the best email to reach you?']; }, ph: 'Email', ac: 'email', type: 'email', mode: 'email', max: 120 },
      { f: 'phone', say: function () { return ['And a phone number, in case a call is easier?']; }, ph: 'Phone', ac: 'tel', type: 'tel', mode: 'tel', max: 30, skip: true },
      { f: 'reason', say: function () { return ['What brings you here?']; }, choices: [['client', 'Hiring talent'], ['candidate', 'Looking for work'], ['vendor', 'Vendor or partner']] },
      { f: 'message', say: function () { return ['Tell us a little about it. A few sentences help us pass you to the right person.']; }, ph: 'Message', area: true, max: 999 }
    ];
    var ans, at, openedAt, busy, sent;
    var reset = function () { ans = { name: '', company: '', email: '', phone: '', reason: '', message: '' }; at = -1; busy = false; sent = false; };
    reset();

    // ---- the floating button: company mark, thin edge with a travelling light ----
    var fab = el('button', 'chat-fab', '<span class="cf-glow"></span><span class="cf-ring"></span><span class="cf-face">' + MARK.replace('width="40" height="40"', 'width="30" height="30"') + '</span>');
    fab.type = 'button'; fab.setAttribute('aria-label', 'Message the Triada team'); fab.setAttribute('aria-haspopup', 'dialog');

    // ---- the chat window ----
    var ov = el('div', 'chat-ov'); ov.hidden = true;
    var card = el('div', 'chat-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', 'Message the Triada team');
    card.innerHTML =
      '<div class="ch-head"><span class="ch-av">' + MARK + '</span><span class="ch-id"><strong>Triada Technologies</strong><span>Replies within 24 hours</span></span>' +
      '<button type="button" class="ch-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button></div>' +
      '<div class="ch-log" role="log" aria-live="polite"></div>' +
      '<div class="ch-quick"></div>' +
      '<form class="ch-compose" novalidate><div class="cc-row"><span class="cc-field"></span>' +
      '<button type="submit" class="cc-send" aria-label="Send" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></div>' +
      '<div class="cc-hint" aria-live="polite"></div><input class="ch-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"></form>' +
      '<div class="ch-done" hidden></div>';
    ov.appendChild(card);
    document.body.appendChild(fab); document.body.appendChild(ov);
    var log = card.querySelector('.ch-log'), quick = card.querySelector('.ch-quick'), form = card.querySelector('.ch-compose'),
        slot = card.querySelector('.cc-field'), sendBtn = card.querySelector('.cc-send'), hint = card.querySelector('.cc-hint'), done = card.querySelector('.ch-done');
    var field = null;

    var toBottom = function () { log.scrollTop = log.scrollHeight; };
    var bubble = function (who, text, extra) {
      var b = el('div', 'bub ' + who + (extra ? ' ' + extra : ''));
      b.textContent = text; log.appendChild(b); toBottom(); return b;
    };
    // the team "types" for a moment before each line, like a real conversation
    var teamSays = function (lines, then) {
      var i = 0;
      var nextLine = function () {
        if (i >= lines.length) { then && then(); return; }
        var t = el('div', 'bub them typing', '<i></i><i></i><i></i>'); t.setAttribute('aria-label', 'Typing'); log.appendChild(t); toBottom();
        later(function () { t.remove(); bubble('them', lines[i++]); later(nextLine, 260); }, 520 + Math.min(lines[i].length * 9, 520));
      };
      nextLine();
    };
    var composer = function (s) {
      quick.innerHTML = ''; hint.textContent = ''; hint.className = 'cc-hint';
      form.classList.toggle('is-off', !!s.choices);
      if (s.choices) {
        s.choices.forEach(function (c) {
          var b = el('button', 'qr', esc(c[1])); b.type = 'button';
          b.addEventListener('click', function () { if (busy) return; ans.reason = c[0]; answer(c[1]); });
          quick.appendChild(b);
        });
        field = null; slot.innerHTML = ''; return;
      }
      if (s.skip) {
        var k = el('button', 'qr qr-skip', 'Skip'); k.type = 'button';
        k.addEventListener('click', function () { if (busy) return; ans[s.f] = ''; answer('Skip', 'skipped'); });
        quick.appendChild(k);
      }
      field = el(s.area ? 'textarea' : 'input', 'cc-in');
      if (s.area) { field.rows = 1; } else { field.type = s.type || 'text'; field.autocomplete = s.ac; }
      if (s.mode) field.setAttribute('inputmode', s.mode);
      if (s.f === 'name') field.setAttribute('autocapitalize', 'words');
      field.maxLength = s.max; field.placeholder = s.ph; field.setAttribute('aria-label', s.ph);
      field.setAttribute('enterkeyhint', s.area ? 'enter' : 'send');
      slot.innerHTML = ''; slot.appendChild(field);
      var sync = function () {
        var v = field.value.trim();
        sendBtn.disabled = !v;
        if (s.area) {
          field.style.height = 'auto'; field.style.height = Math.min(field.scrollHeight, 132) + 'px'; toBottom();
          hint.className = 'cc-hint';
          hint.textContent = v.length < 60 ? 'At least 60 characters, ' + v.length + ' so far' : v.length + ' / 999';
        } else if (hint.classList.contains('is-bad')) { hint.textContent = ''; hint.className = 'cc-hint'; }
      };
      field.addEventListener('input', sync); sync();
      later(function () { try { field.focus({ preventScroll: true }); } catch (e) { field.focus(); } }, 60);
    };
    var ask = function () {
      at++; busy = true; form.classList.add('is-off'); quick.innerHTML = '';
      var s = steps[at];
      teamSays(s.say(ans), function () { busy = false; composer(s); });
    };
    var answer = function (text, extra) {
      busy = true; quick.innerHTML = ''; form.classList.add('is-off');
      bubble('me', text, extra);
      if (steps[at].f === 'message') { later(send, 380); return; }
      later(ask, 380);
    };
    var refuse = function (t) {
      hint.textContent = t; hint.className = 'cc-hint is-bad';
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      if (field) field.focus();
    };
    form.addEventListener('animationend', function () { form.classList.remove('shake'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy || !field) return;
      var s = steps[at], v = field.value.trim(), t = rules[s.f] ? rules[s.f](v) : '';
      if (!v) { if (s.skip) { ans[s.f] = ''; answer('Skip', 'skipped'); } else refuse(rules[s.f] ? rules[s.f]('') : 'Type an answer first.'); return; }
      if (t) { refuse(t); return; }
      ans[s.f] = v; answer(v);
    });
    // Enter sends in single-line answers; in the message box it adds a new line
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' && field && field.tagName === 'INPUT') { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); } });

    // ---- sending: the same function, the same fields and the same bot checks as the website's contact form ----
    var send = function () {
      var t = el('div', 'bub them typing', '<i></i><i></i><i></i>'); log.appendChild(t); toBottom();
      var failed = function (text) {
        t.remove(); bubble('them', text, 'is-err'); busy = false;
        composer(steps[at]); if (field) { field.value = ans.message; field.dispatchEvent(new Event('input')); }
      };
      if (CHAT.bypass) { later(function () { t.remove(); finish(); }, 700); return; }
      fetch(CHAT.api, {
        method: 'POST',
        headers: { apikey: CHAT.key, 'Content-Type': 'application/json', 'x-region': 'us-east-1' },
        body: JSON.stringify({ name: ans.name, company: ans.company, email: ans.email, phone: ans.phone, reason: ans.reason || 'client',
                               message: ans.message, website: form.elements.website.value, t: Date.now() - openedAt })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
        .then(function (x) {
          if (x.r.ok && x.j.ok) { t.remove(); finish(); return; }
          if (x.r.status === 400 && x.j.fields) failed(x.j.fields[Object.keys(x.j.fields)[0]]);
          else if (x.r.status === 429) failed('You have sent several messages already. Please try again later, or email ' + CHAT.email + '.');
          else failed('The message did not go through. Tap send to try again, or email ' + CHAT.email + '.');
        })
        .catch(function () { failed('We could not reach our server. Tap send to try again, or email ' + CHAT.email + '.'); });
    };

    // ---- the confirmation: a check mark draws itself, then the details settle in ----
    var finish = function () {
      sent = true;
      done.innerHTML =
        '<svg class="dn-check" viewBox="0 0 80 80" aria-hidden="true"><circle class="dn-disc" cx="40" cy="40" r="36"/><circle class="dn-ring" cx="40" cy="40" r="36"/><path class="dn-tick" d="M25 41.5l10 10 20-22"/></svg>' +
        '<h2 class="dn-title" tabindex="-1">Message sent</h2>' +
        '<p class="dn-sub">Thanks' + (ans.name ? ', ' + esc(ans.name) : '') + '. Someone from our team will reply within 24 hours.</p>' +
        '<p class="dn-or">Need us sooner?</p>' +
        '<div class="dn-list"><a href="' + CHAT.phoneHref + '"><span class="dn-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h2.6l1.4 4-2 1.3a12 12 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/></svg></span><span>' + CHAT.phone + '</span></a>' +
        '<a href="mailto:' + CHAT.email + '"><span class="dn-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7.5 8 6 8-6"/></svg></span><span>' + CHAT.email + '</span></a></div>' +
        '<button type="button" class="dn-btn">Done</button>';
      done.querySelector('.dn-btn').addEventListener('click', close);
      card.classList.add('is-sent');
      later(function () { log.hidden = true; quick.hidden = true; form.hidden = true; done.hidden = false; done.querySelector('.dn-title').focus({ preventScroll: true }); }, 220);
    };

    // ---- opening and closing (CSS spring): the window grows out of the button and folds back into it ----
    var isOpen = false, lastFocus = null, shutTimer = 0;
    var aim = function () {
      var a = fab.getBoundingClientRect(), c = card.getBoundingClientRect();
      card.style.setProperty('--ox', Math.round(a.left + a.width / 2 - (c.left + c.width / 2)) + 'px');
      card.style.setProperty('--oy', Math.round(a.top + a.height / 2 - (c.top + c.height / 2)) + 'px');
    };
    var open = function () {
      if (isOpen) return; isOpen = true; lastFocus = document.activeElement; clearTimeout(shutTimer);
      if (sent) {   // a finished conversation starts fresh
        reset(); log.innerHTML = ''; log.hidden = false; quick.hidden = false; form.hidden = false; done.hidden = true; done.innerHTML = ''; card.classList.remove('is-sent');
      }
      ov.classList.remove('is-shut'); ov.hidden = false; root.classList.add('chat-open'); fab.classList.add('is-away');
      fit(); aim(); void card.offsetWidth; ov.classList.add('is-open');
      if (at < 0) { openedAt = Date.now(); later(ask, 280); }
      else if (field) later(function () { field.focus({ preventScroll: true }); }, 300);
    };
    var close = function () {
      if (!isOpen) return; isOpen = false;
      aim(); ov.classList.remove('is-open'); ov.classList.add('is-shut'); fab.classList.remove('is-away');
      var gone = function () { if (isOpen) return; ov.hidden = true; ov.classList.remove('is-shut'); root.classList.remove('chat-open'); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); };
      shutTimer = setTimeout(gone, calm() ? 0 : 340);
    };
    fab.addEventListener('click', open);
    card.querySelector('.ch-x').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {   // keep the focus inside the window
        var f = Array.prototype.filter.call(card.querySelectorAll('button, input:not(.ch-trap), textarea, a[href]'), function (n) { return !n.disabled && n.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // on-screen keyboard: the window shrinks to the visible part of the screen so the composer stays in view
    var fit = function () {
      if (!window.visualViewport) return;
      ov.style.height = window.visualViewport.height + 'px'; ov.style.top = window.visualViewport.offsetTop + 'px'; toBottom();
    };
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', function () { if (isOpen) fit(); }); window.visualViewport.addEventListener('scroll', function () { if (isOpen) fit(); }); }
  }
  if (active()) buildChat();
  if (phone.addEventListener) phone.addEventListener('change', buildChat);
})();
