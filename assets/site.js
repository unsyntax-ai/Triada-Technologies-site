(function () {
  var root = document.documentElement;
  root.classList.add('js');

  // Top bar: frosted and transparent once the page is scrolled
  var header = document.querySelector('header.site');
  function onScroll() {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Fade sections and cards in as they enter the screen
  var targets = document.querySelectorAll('main section > .wrap, main .hero-grid, main .page-hero .wrap, main .card, main .marquee');
  targets.forEach(function (el, i) { el.classList.add('reveal'); el.style.transitionDelay = ((i % 3) * 90) + 'ms'; });
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('in'); });
  }


  // Home page only: scroll-linked motion (parallax hero, progress bar, stagger)
  var hero = document.querySelector('.hero-full');
  if (hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('home-motion');
    document.body.classList.add('home-motion');
    var bar = document.createElement('div'); bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
    var ticking = false;
    var step = function () {
      var y = window.scrollY, h = hero.offsetHeight || 1;
      var p = Math.min(1, Math.max(0, y / h));
      hero.style.setProperty('--p', p.toFixed(3));
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--sp', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
      ticking = false;
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(step); } }, { passive: true });
    window.addEventListener('resize', step);
    step();
    // cards in a row arrive one after another
    document.querySelectorAll('.values, .trio, .industries, .steps').forEach(function (g) {
      Array.prototype.forEach.call(g.querySelectorAll('.card'), function (c, i) { c.style.transitionDelay = (i * 140) + 'ms'; });
    });
  }

  // FAQ accordion: a row opens downward and closes upward with a smooth height change
  Array.prototype.forEach.call(document.querySelectorAll('.faq-item'), function (d) {
    var sum = d.querySelector('summary'), body = d.querySelector('.faq-a'), anim = null;
    sum.addEventListener('click', function (e) {
      if (!d.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // plain open/close
      e.preventDefault();
      if (anim) anim.cancel();
      var edge = d.offsetHeight - d.clientHeight, from = d.offsetHeight, opening = !d.open;
      if (opening) d.open = true;
      var to = sum.offsetHeight + (opening ? body.offsetHeight : 0) + edge;
      d.style.overflow = 'hidden';
      anim = d.animate({ height: [from + 'px', to + 'px'] }, { duration: 360, easing: 'cubic-bezier(.2,.7,.2,1)' });
      anim.onfinish = function () { if (!opening) d.open = false; anim = null; d.style.overflow = ''; };
      anim.oncancel = function () { d.style.overflow = ''; };
    });
  });

  // Insights lists: search, date filter, sort, load more
  var list = document.getElementById('items');
  if (list) {
    var q = document.getElementById('q');
    var mo = document.getElementById('month');
    var so = document.getElementById('sort');
    var more = document.getElementById('more');
    var empty = document.getElementById('empty');
    var pageSize = parseInt(list.closest('.listing').getAttribute('data-page'), 10) || 9;
    var items = Array.prototype.slice.call(list.querySelectorAll('[data-item]'));
    var shown = pageSize;
    var render = function () {
      var term = q.value.trim().toLowerCase();
      var month = mo.value;
      var oldest = so.value === 'old';
      items.sort(function (a, b) {
        var x = a.getAttribute('data-date'), y = b.getAttribute('data-date');
        return oldest ? (x < y ? -1 : x > y ? 1 : 0) : (x < y ? 1 : x > y ? -1 : 0);
      });
      var match = 0;
      items.forEach(function (el) {
        list.appendChild(el);
        var ok = (!month || el.getAttribute('data-date').slice(0, 7) === month) &&
                 (!term || el.getAttribute('data-text').indexOf(term) !== -1);
        if (ok) { match++; el.hidden = match > shown; } else { el.hidden = true; }
      });
      empty.hidden = match !== 0;
      more.hidden = match <= shown;
    };
    [q, mo, so].forEach(function (c) {
      c.addEventListener(c === q ? 'input' : 'change', function () { shown = pageSize; render(); });
    });
    more.addEventListener('click', function () { shown += pageSize; render(); });
    render();
  }

  // Contact form: preview only
  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = document.getElementById('form-status');
      var name = document.getElementById('name').value.trim();
      var email = document.getElementById('email').value.trim();
      var message = document.getElementById('message').value.trim();
      if (!name || !email || !message) {
        status.textContent = 'Please fill in your name, email, and message.';
        return;
      }
      status.textContent = 'Preview only. The form is not connected yet, so nothing was sent.';
    });
  }
})();
