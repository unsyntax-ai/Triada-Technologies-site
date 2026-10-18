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
