// Admin page: sign in by email link, draft with AI, publish, schedule and manage jobs.
(function () {
  var T = window.TRIADA;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'triada_admin';
  var memory = null;
  var editing = null;      // job being edited, or null for a new one
  var jobs = [];

  // ----- session -----
  function load() {
    try { var s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) { /* ignore */ }
    return memory;
  }
  function save(s) {
    memory = s;
    try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
  function now() { return Math.floor(Date.now() / 1000); }
  function signOut() { save(null); show(); }

  function takeHash() {
    if (!location.hash || location.hash.length < 2) return null;
    var p = new URLSearchParams(location.hash.slice(1));
    if (p.get('error_description')) {
      history.replaceState(null, '', location.pathname);
      return { error: p.get('error_description').replace(/\+/g, ' ') };
    }
    if (p.get('access_token')) {
      var s = { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: now() + (parseInt(p.get('expires_in'), 10) || 3600) };
      save(s);
      history.replaceState(null, '', location.pathname);
    }
    return null;
  }

  function token() {
    var s = load();
    if (!s) return Promise.reject(new Error('Signed out'));
    if (s.expires_at - now() > 60) return Promise.resolve(s.access_token);
    return fetch(T.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: T.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (r) { if (!r.ok) throw new Error('expired'); return r.json(); })
      .then(function (d) {
        save({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: now() + (d.expires_in || 3600) });
        return d.access_token;
      })
      .catch(function () { signOut(); throw new Error('Signed out'); });
  }

  function api(path, opts) {
    return token().then(function (t) {
      opts = opts || {};
      opts.headers = Object.assign({ apikey: T.key, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, opts.headers || {});
      return fetch(T.url + path, opts);
    }).then(function (r) {
      if (r.status === 401) { signOut(); throw new Error('Please sign in again.'); }
      return r.text().then(function (x) {
        var data = null;
        try { data = x ? JSON.parse(x) : null; } catch (e) { /* ignore */ }
        if (!r.ok) throw new Error((data && (data.error || data.message)) || 'Something went wrong (' + r.status + ').');
        return data;
      });
    });
  }

  function msg(id, text, kind) {
    var n = $(id);
    n.textContent = text || '';
    n.className = 'a-msg' + (kind ? ' ' + kind : '');
  }

  // ----- views -----
  function who() {
    try {
      var p = JSON.parse(atob(load().access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return p.email || '';
    } catch (e) { return ''; }
  }
  function show() {
    var on = !!load();
    $('a-signin').hidden = on;
    $('a-app').hidden = !on;
    if (on) { $('a-who').textContent = who(); refresh(); }
  }

  $('a-send').addEventListener('click', function () {
    var email = $('a-email').value.trim();
    if (!email) { msg('a-msg', 'Enter your admin email.', 'bad'); return; }
    $('a-send').disabled = true;
    fetch(T.url + '/auth/v1/otp?redirect_to=' + encodeURIComponent(location.origin + location.pathname), {
      method: 'POST', headers: { apikey: T.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, create_user: false })
    }).then(function (r) {
      if (r.status === 429) msg('a-msg', 'Too many requests. Please wait a minute and try again.', 'bad');
      else msg('a-msg', 'If that address is allowed, a sign-in link is on its way. Open it on this device.', 'ok');
    }).catch(function () { msg('a-msg', 'Could not reach the sign-in service. Check your connection.', 'bad'); })
      .then(function () { $('a-send').disabled = false; });
  });
  $('a-out').addEventListener('click', signOut);

  // ----- AI draft -----
  $('a-draft').addEventListener('click', function () {
    var notes = $('a-notes').value.trim();
    if (notes.length < 20) { msg('a-draft-msg', 'Add a few more details about the role first.', 'bad'); return; }
    $('a-draft').disabled = true;
    msg('a-draft-msg', 'Drafting. This takes a few seconds.', '');
    token().then(function (t) {
      return fetch(T.url + '/functions/v1/draft-job', {
        method: 'POST', headers: { apikey: T.key, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes })
      });
    }).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'The draft failed.'); return d; });
    }).then(function (d) {
      fill(d);
      var c = $('f-confirm');
      c.textContent = '';
      if (d.confirm && d.confirm.length) {
        var h = document.createElement('strong'); h.textContent = 'Please check before publishing:'; c.appendChild(h);
        var ul = document.createElement('ul');
        d.confirm.forEach(function (t2) { var li = document.createElement('li'); li.textContent = t2; ul.appendChild(li); });
        c.appendChild(ul); c.hidden = false;
      } else { c.hidden = true; }
      msg('a-draft-msg', 'Draft ready below. Read it, edit anything, then save.', 'ok');
      $('f-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function (e) { msg('a-draft-msg', e.message, 'bad'); })
      .then(function () { $('a-draft').disabled = false; });
  });

  // ----- form -----
  function lines(v) { return v.split('\n').map(function (x) { return x.replace(/^[-•*\s]+/, '').trim(); }).filter(Boolean); }
  function fill(d) {
    $('f-title').value = d.title || '';
    $('f-location').value = d.location || '';
    $('f-type').value = d.employment_type || 'Contract';
    $('f-pay').value = d.pay || '';
    $('f-summary').value = d.summary || '';
    $('f-resp').value = (d.responsibilities || []).join('\n');
    $('f-req').value = (d.requirements || []).join('\n');
  }
  function plus(days) { var d = new Date(Date.now() + days * 864e5); return d.toISOString().slice(0, 10); }
  function localInput(iso) {
    var d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
  function setWhen(v) {
    document.querySelectorAll('input[name="when"]').forEach(function (r) { r.checked = r.value === v; });
    $('keep-row').hidden = !editing;
  }
  function clearForm() {
    editing = null;
    fill({});
    $('f-location').value = 'Remote (U.S.)';
    $('f-when').value = '';
    $('f-exp').value = plus(60);
    $('f-confirm').hidden = true;
    $('f-save').textContent = 'Save job';
    $('form-title').textContent = 'New job';
    setWhen('draft');
    msg('f-msg', '');
  }
  $('f-clear').addEventListener('click', clearForm);

  $('f-save').addEventListener('click', function () {
    var title = $('f-title').value.trim(), summary = $('f-summary').value.trim();
    if (!title || !summary) { msg('f-msg', 'A title and a summary are required.', 'bad'); return; }
    var when = (document.querySelector('input[name="when"]:checked') || {}).value || 'draft';
    var body = {
      title: title, location: $('f-location').value.trim() || 'Remote (U.S.)', employment_type: $('f-type').value,
      pay: $('f-pay').value.trim() || null, summary: summary,
      responsibilities: lines($('f-resp').value), requirements: lines($('f-req').value),
      expires_at: $('f-exp').value ? new Date($('f-exp').value + 'T23:59:00').toISOString() : null,
      updated_at: new Date().toISOString()
    };
    var start = null;
    if (when === 'draft') { body.status = 'draft'; body.publish_at = null; }
    else if (when === 'now') { body.status = 'published'; start = new Date(Date.now() - 60000); body.publish_at = start.toISOString(); }
    else if (when === 'later') {
      if (!$('f-when').value) { msg('f-msg', 'Choose the date and time to publish.', 'bad'); return; }
      body.status = 'published'; start = new Date($('f-when').value); body.publish_at = start.toISOString();
    } else if (editing && editing.publish_at) { start = new Date(editing.publish_at); }
    if (body.expires_at && start && new Date(body.expires_at) <= start) { msg('f-msg', 'The expiry date must be after the publish date.', 'bad'); return; }
    $('f-save').disabled = true;
    var req = editing
      ? api('/rest/v1/jobs?id=eq.' + editing.id, { method: 'PATCH', body: JSON.stringify(body), headers: { Prefer: 'return=representation' } })
      : api('/rest/v1/jobs', { method: 'POST', body: JSON.stringify(body), headers: { Prefer: 'return=representation' } });
    req.then(function () {
      var label = when === 'draft' ? 'Saved as a draft.' : when === 'later' ? 'Scheduled. It will appear on the Jobs page at that time.' : 'Saved.';
      clearForm(); msg('f-msg', label, 'ok'); refresh();
    }).catch(function (e) { msg('f-msg', e.message, 'bad'); })
      .then(function () { $('f-save').disabled = false; });
  });

  // ----- list -----
  function state(j) {
    var n = Date.now();
    if (j.status === 'draft') return 'Draft';
    if (j.status === 'closed') return 'Closed';
    if (j.expires_at && new Date(j.expires_at) <= n) return 'Expired';
    if (new Date(j.publish_at) > n) return 'Scheduled';
    return 'Live';
  }
  function fmt(iso) { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }

  function refresh() {
    api('/rest/v1/jobs?select=*&order=created_at.desc').then(function (rows) {
      jobs = rows; renderList();
    }).catch(function (e) { msg('a-jobs-msg', e.message, 'bad'); });
  }
  function button(label, cls, fn) {
    var b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label;
    b.addEventListener('click', fn); return b;
  }
  function renderList() {
    var box = $('a-jobs'); box.textContent = '';
    msg('a-jobs-msg', jobs.length ? '' : 'No jobs yet. Create your first one above.', '');
    jobs.forEach(function (j) {
      var st = state(j);
      var row = document.createElement('div'); row.className = 'a-job';
      var info = document.createElement('div');
      var h = document.createElement('strong'); h.textContent = j.title;
      var pill = document.createElement('span'); pill.className = 'pill pill-' + st.toLowerCase(); pill.textContent = st;
      var m = document.createElement('p'); m.className = 'meta';
      m.textContent = [j.location, j.employment_type, j.publish_at ? 'Starts ' + fmt(j.publish_at) : null, j.expires_at ? 'Ends ' + fmt(j.expires_at) : null].filter(Boolean).join(' · ');
      info.appendChild(h); info.appendChild(pill); info.appendChild(m);
      var acts = document.createElement('div'); acts.className = 'a-acts';
      acts.appendChild(button('Edit', 'btn btn-white btn-sm', function () { edit(j); }));
      if (j.status === 'published') acts.appendChild(button('Close', 'btn btn-white btn-sm', function () { patch(j, { status: 'closed' }); }));
      if (j.status === 'closed') acts.appendChild(button('Reopen', 'btn btn-white btn-sm', function () { patch(j, { status: 'published', publish_at: j.publish_at || new Date(Date.now() - 60000).toISOString() }); }));
      var del = button('Delete', 'btn btn-white btn-sm', function () {
        if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Click again to delete'; setTimeout(function () { del.dataset.sure = ''; del.textContent = 'Delete'; }, 4000); return; }
        api('/rest/v1/jobs?id=eq.' + j.id, { method: 'DELETE' }).then(refresh).catch(function (e) { msg('a-jobs-msg', e.message, 'bad'); });
      });
      acts.appendChild(del);
      row.appendChild(info); row.appendChild(acts); box.appendChild(row);
    });
  }
  function patch(j, fields) {
    fields.updated_at = new Date().toISOString();
    api('/rest/v1/jobs?id=eq.' + j.id, { method: 'PATCH', body: JSON.stringify(fields) }).then(refresh)
      .catch(function (e) { msg('a-jobs-msg', e.message, 'bad'); });
  }
  function edit(j) {
    editing = j;
    fill(j);
    $('f-exp').value = j.expires_at ? j.expires_at.slice(0, 10) : '';
    $('f-when').value = j.publish_at ? localInput(j.publish_at) : '';
    $('f-confirm').hidden = true;
    $('f-save').textContent = 'Update job';
    $('form-title').textContent = 'Edit job';
    setWhen('keep');
    msg('f-msg', 'Editing "' + j.title + '". "Keep as it is" leaves the status and start date unchanged.', '');
    $('form-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ----- start -----
  var problem = takeHash();
  clearForm();
  show();
  if (problem) msg('a-msg', problem.error + ' Request a new link below.', 'bad');
  window.addEventListener('hashchange', function () { var pr = takeHash(); show(); if (pr) msg('a-msg', pr.error + ' Request a new link below.', 'bad'); });
})();
