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


  // Insights archive: search and month filter
  var aSearch = document.getElementById('archive-search');
  var aMonth = document.getElementById('archive-month');
  if (aSearch && aMonth) {
    var rows = document.querySelectorAll('#archive-list .archive-row');
    var empty = document.getElementById('archive-empty');
    var apply = function () {
      var q = aSearch.value.trim().toLowerCase();
      var m = aMonth.value;
      var shown = 0;
      rows.forEach(function (r) {
        var ok = (!m || r.getAttribute('data-month') === m) && (!q || r.getAttribute('data-text').indexOf(q) !== -1);
        r.hidden = !ok;
        if (ok) shown++;
      });
      empty.hidden = shown !== 0;
    };
    aSearch.addEventListener('input', apply);
    aMonth.addEventListener('change', apply);
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
