// Admin page: 6-digit PIN to open (checked on the server), email code as the backup, then drafting, publishing and job management.
(function () {
  var T = window.TRIADA;
  var $ = function (id) { return document.getElementById(id); };
  var session = null;     // admin session, kept in memory only: closing or reloading the page asks for the PIN again
  var unlocked = false;   // true only after the PIN was accepted on this visit (or a new PIN was just saved)
  var gate = 'pin';       // which sign-in panel shows: 'pin' | 'email' | 'reset' | 'done'
  var busy = false;
  var editing = null;      // job being edited, or null for a new one
  var jobs = [];
  var tab = 'published';   // jobs table tab: 'published' | 'draft' | 'archived'
  var page = 1;
  var PER_PAGE = 5;
  var KEEP_DAYS = 365;     // archived jobs are deleted for good after this many days
  var resetEmail = '';
  var OBVIOUS = ['123456', '234567', '345678', '456789', '567890', '654321', '987654'];

  // ----- session -----
  function load() { return session; }
  function save(s) { session = s; }
  function now() { return Math.floor(Date.now() / 1000); }
  function signOut() {
    save(null); unlocked = false; gate = 'pin';
    ['a-pin', 'a-code', 'a-new-pin', 'a-confirm-pin'].forEach(function (id) { clearBoxes($(id)); });
    show();
  }

  // the email sign-in link (if used) lands here with the session in the address
  function takeHash() {
    if (!location.hash || location.hash.length < 2) return null;
    var p = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname);
    if (p.get('error_description')) return { error: p.get('error_description').replace(/\+/g, ' ') };
    if (p.get('access_token')) {
      save({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: now() + (parseInt(p.get('expires_in'), 10) || 3600) });
      return { emailSignIn: true };
    }
    return null;
  }
  function handleHash(pr) {
    if (!pr) return;
    if (pr.emailSignIn) { gate = 'reset'; }
    else { gate = 'email'; msg('a-msg', pr.error + ' Request a new code.', 'bad'); }
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
  function show() {
    var open = unlocked && !!load();
    $('a-signin').hidden = open;
    $('a-app').hidden = !open;
    $('a-out').hidden = !open;
    $('a-gate-pin').hidden = gate !== 'pin';
    $('a-gate-email').hidden = gate !== 'email';
    $('a-gate-reset').hidden = gate !== 'reset';
    $('a-gate-done').hidden = gate !== 'done';
    // after an email-link sign-in the code is already checked, so only the new PIN is asked for
    $('a-sect-code').hidden = !!load();
    if (open) refresh(); else focusGate();
  }
  function focusGate() {
    if (gate === 'pin') focusFirst($('a-pin'));
    else if (gate === 'email') $('a-email').focus();
    else if (gate === 'reset') focusFirst(load() ? $('a-new-pin') : $('a-code'));
  }

  // six single-digit boxes: type, paste, backspace and arrows work; completing the sixth calls onComplete
  function boxes(root) { return Array.prototype.slice.call(root.querySelectorAll('input')); }
  function code(root) { return boxes(root).map(function (b) { return b.value; }).join(''); }
  function clearBoxes(root) { boxes(root).forEach(function (b) { b.value = ''; }); }
  function focusFirst(root) { var b = boxes(root)[0]; if (b) b.focus(); }
  // red boxes and a message directly below them; typing again clears both
  function setErr(root, msgId, text) {
    root.dataset.msg = msgId;
    root.classList.toggle('bad', !!text);
    msg(msgId, text, text ? 'bad' : '');
  }
  function wireBoxes(root, msgId, onComplete) {
    var all = boxes(root);
    root.dataset.msg = msgId;
    all.forEach(function (box, i) {
      box.addEventListener('input', function () {
        var v = box.value.replace(/\D/g, '');
        box.value = v.slice(-1);
        if (root.classList.contains('bad')) setErr(root, msgId, '');
        if (v && i < all.length - 1) all[i + 1].focus();
        if (all.every(function (b) { return b.value; })) onComplete();
      });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !box.value && i > 0) { all[i - 1].focus(); all[i - 1].value = ''; }
        else if (e.key === 'ArrowLeft' && i > 0) all[i - 1].focus();
        else if (e.key === 'ArrowRight' && i < all.length - 1) all[i + 1].focus();
        else if (e.key === 'Enter' && all.every(function (b) { return b.value; })) onComplete();
      });
      box.addEventListener('paste', function (e) {
        var t = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '').slice(0, 6);
        if (!t) return;
        e.preventDefault();
        if (root.classList.contains('bad')) setErr(root, msgId, '');
        t.split('').forEach(function (ch, k) { all[k].value = ch; });
        all[Math.min(t.length, 5)].focus();
        if (t.length === 6) onComplete();
      });
      box.addEventListener('focus', function () { box.select(); });
    });
  }

  function goTo(next, text, kind) {
    gate = next;
    if (text) msg('a-msg', text, kind);
    show();
  }

  // ----- PIN -----
  function unlock() {
    var pin = code($('a-pin'));
    if (busy || pin.length !== 6) return;
    busy = true;
    fetch(T.url + '/functions/v1/admin-pin', {
      method: 'POST', headers: { apikey: T.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unlock', pin: pin })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        clearBoxes($('a-pin'));
        if (d.state === 'ok' && d.session) {
          save({ access_token: d.session.access_token, refresh_token: d.session.refresh_token, expires_at: now() + (d.session.expires_in || 3600) });
          unlocked = true; setErr($('a-pin'), 'a-pin-msg', ''); show();
        } else if (d.state === 'wrong') {
          setErr($('a-pin'), 'a-pin-msg', 'Wrong PIN. Please try again.');
          focusFirst($('a-pin'));
        } else if (d.state === 'locked') {
          goTo('email', 'Too many wrong PINs. Request a code to set a new PIN.', 'bad');
        } else if (d.state === 'no_pin') {
          goTo('email', '', '');
        } else {
          setErr($('a-pin'), 'a-pin-msg', 'Could not check the PIN. Check your connection and try again.');
          focusFirst($('a-pin'));
        }
      })
      .catch(function () { setErr($('a-pin'), 'a-pin-msg', 'Could not reach the sign-in service. Check your connection.'); focusFirst($('a-pin')); })
      .then(function () { busy = false; });
  }
  wireBoxes($('a-pin'), 'a-pin-msg', unlock);
  $('a-forgot').addEventListener('click', function () { msg('a-msg', ''); goTo('email'); });

  // ----- email code, then the new PIN -----
  function sendCode() {
    var email = $('a-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg('a-msg', 'Enter a valid email address.', 'bad'); $('a-email').focus(); return; }
    $('a-send').disabled = true;
    msg('a-msg', '');
    fetch(T.url + '/auth/v1/otp?redirect_to=' + encodeURIComponent(location.origin + location.pathname), {
      method: 'POST', headers: { apikey: T.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, create_user: false })
    }).then(function (r) {
      if (r.status === 429) msg('a-msg', 'Too many requests. Please wait a minute and try again.', 'bad');
      else if (!r.ok) msg('a-msg', 'This email is not registered as an admin. Check it and try again.', 'bad');
      else { resetEmail = email; clearBoxes($('a-code')); goTo('reset'); }
    }).catch(function () { msg('a-msg', 'Could not reach the sign-in service. Check your connection.', 'bad'); })
      .then(function () { $('a-send').disabled = false; });
  }
  $('a-send').addEventListener('click', sendCode);
  $('a-email').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendCode(); });
  function back() { save(null); msg('a-msg', ''); goTo('pin'); }
  $('a-back-pin').addEventListener('click', back);
  $('a-back-reset').addEventListener('click', back);

  function pinProblem(p) {
    return (/^(\d)\1{5}$/.test(p) || OBVIOUS.indexOf(p) >= 0) ? 'Choose a less obvious PIN.' : '';
  }
  function checkCode(entered) {
    return fetch(T.url + '/auth/v1/verify', {
      method: 'POST', headers: { apikey: T.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email', email: resetEmail, token: entered })
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.access_token) throw new Error(); return d; }); })
      .then(function (d) { save({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: now() + (d.expires_in || 3600) }); })
      .catch(function () { var e = new Error('That code is incorrect or has expired.'); e.kind = 'code'; throw e; });
  }
  // runs when the last digit of the confirmation PIN is typed
  function finishReset() {
    if (busy) return;
    var cBox = $('a-code'), nBox = $('a-new-pin'), fBox = $('a-confirm-pin');
    var entered = code(cBox), a = code(nBox), b = code(fBox), needCode = !load();
    setErr(cBox, 'a-code-msg', ''); setErr(nBox, 'a-new-msg', ''); setErr(fBox, 'a-conf-msg', '');
    if (needCode && entered.length !== 6) { setErr(cBox, 'a-code-msg', 'Enter the 6-digit code from your email.'); focusFirst(cBox); return; }
    var bad = pinProblem(a);
    if (bad) { setErr(nBox, 'a-new-msg', bad); clearBoxes(nBox); clearBoxes(fBox); focusFirst(nBox); return; }
    if (a !== b) { setErr(fBox, 'a-conf-msg', 'The PINs do not match. Please try again.'); clearBoxes(fBox); focusFirst(fBox); return; }
    busy = true;
    (needCode ? checkCode(entered) : Promise.resolve())
      .then(function () { return api('/functions/v1/admin-pin', { method: 'POST', body: JSON.stringify({ action: 'set', pin: a }) }); })
      .then(function () {
        clearBoxes(cBox); clearBoxes(nBox); clearBoxes(fBox);
        gate = 'done'; show();
        setTimeout(function () { unlocked = true; show(); }, 1900);
      })
      .catch(function (e) {
        if (e.kind === 'code') { setErr(cBox, 'a-code-msg', e.message); clearBoxes(cBox); focusFirst(cBox); return; }
        setErr(nBox, 'a-new-msg', e.message); clearBoxes(nBox); clearBoxes(fBox); focusFirst(nBox);
      })
      .then(function () { busy = false; });
  }
  wireBoxes($('a-code'), 'a-code-msg', function () {
    // after a wrong code was retyped, the PINs are still filled in: go straight on
    if (code($('a-new-pin')).length === 6 && code($('a-confirm-pin')).length === 6) finishReset();
    else focusFirst($('a-new-pin'));
  });
  wireBoxes($('a-new-pin'), 'a-new-msg', function () {
    var bad = pinProblem(code($('a-new-pin')));
    if (bad) { setErr($('a-new-pin'), 'a-new-msg', bad); clearBoxes($('a-new-pin')); focusFirst($('a-new-pin')); return; }
    focusFirst($('a-confirm-pin'));
  });
  wireBoxes($('a-confirm-pin'), 'a-conf-msg', finishReset);

  $('a-out').addEventListener('click', signOut);

  // on opening the page: an email sign-in link goes to choosing a PIN; otherwise the PIN screen shows
  handleHash(takeHash());

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
      msg('a-draft-msg', 'Draft ready below. Review and edit it, then publish.', 'ok');
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
  function localInput(iso) {
    var d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
  function hasContent() {
    return !!editing || ['a-notes', 'f-title', 'f-pay', 'f-summary', 'f-resp', 'f-req'].some(function (id) { return $(id).value.trim(); });
  }
  function closePanels() { $('f-sched').hidden = true; $('f-schedule').setAttribute('aria-expanded', 'false'); $('f-clear-ask').hidden = true; }
  function clearForm() {
    editing = null;
    fill({});
    $('f-location').value = 'Remote (U.S.)';
    $('f-when').value = '';
    $('f-confirm').hidden = true;
    closePanels();
    msg('f-msg', '');
  }
  function clearAll() { clearForm(); $('a-notes').value = ''; msg('a-draft-msg', ''); }

  $('f-clear').addEventListener('click', function () {
    if (!hasContent()) { clearAll(); return; }
    $('f-sched').hidden = true;
    $('f-clear-ask').hidden = false;
    $('f-clear-yes').focus();
  });
  $('f-clear-yes').addEventListener('click', clearAll);
  $('f-clear-no').addEventListener('click', function () { $('f-clear-ask').hidden = true; });

  function needsText() {
    if (!$('f-title').value.trim() || !$('f-summary').value.trim()) { msg('f-msg', 'A title and a summary are required.', 'bad'); return true; }
    return false;
  }
  $('f-schedule').addEventListener('click', function () {
    var p = $('f-sched'), open = p.hidden;
    if (open && needsText()) return;
    $('f-clear-ask').hidden = true;
    p.hidden = !open;
    this.setAttribute('aria-expanded', String(open));
    if (open) {
      msg('f-msg', '');
      $('f-when').min = localInput(new Date().toISOString());
      $('f-when').focus();
      try { $('f-when').showPicker(); } catch (e) { /* the field still works by typing */ }
    }
  });
  $('f-sched-go').addEventListener('click', function () { submit('later'); });
  $('f-now').addEventListener('click', function () { submit('now'); });
  $('f-draft').addEventListener('click', function () { submit('draft'); });

  function submit(when) {
    if (needsText()) return;
    var body = {
      title: $('f-title').value.trim(), location: $('f-location').value.trim() || 'Remote (U.S.)', employment_type: $('f-type').value,
      pay: $('f-pay').value.trim() || null, summary: $('f-summary').value.trim(),
      responsibilities: lines($('f-resp').value), requirements: lines($('f-req').value),
      updated_at: new Date().toISOString()
    };
    var start = null;
    if (when === 'draft') { body.status = 'draft'; body.publish_at = null; }
    else if (when === 'now') {
      body.status = 'published';
      // a job that is already live keeps its original start date
      if (editing && editing.status === 'published' && editing.publish_at && new Date(editing.publish_at) <= Date.now()) start = new Date(editing.publish_at);
      else start = new Date(Date.now() - 60000);
      body.publish_at = start.toISOString();
    } else {
      if (!$('f-when').value) { msg('f-msg', 'Choose the date and time to publish.', 'bad'); return; }
      start = new Date($('f-when').value);
      if (start <= Date.now()) { msg('f-msg', 'Choose a date and time in the future.', 'bad'); return; }
      body.status = 'published'; body.publish_at = start.toISOString();
    }
    var btns = ['f-now', 'f-sched-go', 'f-draft'].map($);
    btns.forEach(function (b) { b.disabled = true; });
    var req = editing
      ? api('/rest/v1/jobs?id=eq.' + editing.id, { method: 'PATCH', body: JSON.stringify(body), headers: { Prefer: 'return=representation' } })
      : api('/rest/v1/jobs', { method: 'POST', body: JSON.stringify(body), headers: { Prefer: 'return=representation' } });
    req.then(function () {
      var label = when === 'draft' ? 'Saved as a draft.' : when === 'later' ? 'Scheduled. It will appear on the Jobs page at that time.' : 'Published. It is now on the Jobs page.';
      clearAll(); msg('f-msg', label, 'ok');
      tab = when === 'draft' ? 'draft' : 'published'; page = 1; refresh();
    }).catch(function (e) { msg('f-msg', e.message, 'bad'); })
      .then(function () { btns.forEach(function (b) { b.disabled = false; }); });
  }

  // ----- jobs table -----
  function state(j) {
    var n = Date.now();
    if (j.status === 'draft') return 'Draft';
    if (j.status === 'closed') return 'Archived';
    if (j.expires_at && new Date(j.expires_at) <= n) return 'Expired';
    if (new Date(j.publish_at) > n) return 'Scheduled';
    return 'Live';
  }
  function tabOf(j) { return j.status === 'draft' ? 'draft' : j.status === 'closed' ? 'archived' : 'published'; }
  function fmt(iso) { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }

  function refresh() {
    var cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
    api('/rest/v1/jobs?status=eq.closed&updated_at=lt.' + encodeURIComponent(cutoff), { method: 'DELETE' }).catch(function () { /* the next visit tries again */ })
      .then(function () { return api('/rest/v1/jobs?select=*&order=created_at.desc'); }).then(function (rows) {
      jobs = rows; renderList();
    }).catch(function (e) { msg('a-jobs-msg', e.message, 'bad'); });
  }
  function button(label, cls, fn) {
    var b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label;
    b.addEventListener('click', fn); return b;
  }
  function cell(label, node) {
    var td = document.createElement('td'); td.dataset.label = label;
    if (typeof node === 'string') td.textContent = node; else td.appendChild(node);
    return td;
  }
  function dates(j) {
    var st = state(j), out = [];
    if (j.status === 'draft') out.push('Saved ' + fmt(j.updated_at || j.created_at));
    else if (j.status === 'closed') {
      var at = new Date(j.updated_at || j.created_at);
      var gone = new Date(at.getTime() + KEEP_DAYS * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      out.push('Archived ' + fmt(at), 'Deleted permanently on ' + gone);
    }
    else out.push((st === 'Scheduled' ? 'Starts ' : 'Live since ') + fmt(j.publish_at));
    if (j.status === 'published' && j.expires_at) out.push('Ends ' + fmt(j.expires_at));
    return out.join(' · ');
  }
  var EMPTY = { published: 'No published jobs yet.', draft: 'No saved drafts.', archived: 'No archived jobs.' };
  function renderList() {
    var counts = { published: 0, draft: 0, archived: 0 };
    jobs.forEach(function (j) { counts[tabOf(j)]++; });
    document.querySelectorAll('.a-tab').forEach(function (t) {
      var on = t.dataset.tab === tab;
      t.setAttribute('aria-selected', String(on));
      t.querySelector('.a-count').textContent = '(' + counts[t.dataset.tab] + ')';
    });
    var list = jobs.filter(function (j) { return tabOf(j) === tab; });
    var pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (page > pages) page = pages;
    var box = $('a-jobs'); box.textContent = '';
    msg('a-jobs-msg', list.length ? '' : EMPTY[tab], '');
    $('a-jobs').closest('.a-table-wrap').hidden = !list.length;
    list.slice((page - 1) * PER_PAGE, page * PER_PAGE).forEach(function (j) {
      var st = state(j);
      var tr = document.createElement('tr');
      var t = document.createElement('div');
      var h = document.createElement('strong'); h.textContent = j.title;
      var pill = document.createElement('span'); pill.className = 'pill pill-' + st.toLowerCase(); pill.textContent = st;
      t.appendChild(h); t.appendChild(pill);
      var acts = document.createElement('div'); acts.className = 'a-acts';
      acts.appendChild(button('Edit', 'btn btn-white btn-sm', function () { edit(j); }));
      if (j.status === 'published') acts.appendChild(button('Archive', 'btn btn-white btn-sm', function () { patch(j, { status: 'closed' }); }));
      if (j.status === 'closed') acts.appendChild(button('Restore', 'btn btn-white btn-sm', function () { patch(j, { status: 'published', publish_at: j.publish_at || new Date(Date.now() - 60000).toISOString() }); }));
      var del = button('Delete', 'btn btn-white btn-sm', function () {
        if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Click again to delete'; setTimeout(function () { del.dataset.sure = ''; del.textContent = 'Delete'; }, 4000); return; }
        api('/rest/v1/jobs?id=eq.' + j.id, { method: 'DELETE' }).then(refresh).catch(function (e) { msg('a-jobs-msg', e.message, 'bad'); });
      });
      acts.appendChild(del);
      tr.appendChild(cell('Job', t));
      tr.appendChild(cell('Location', j.location || ''));
      tr.appendChild(cell('Type', j.employment_type || ''));
      tr.appendChild(cell('Dates', dates(j)));
      tr.appendChild(cell('', acts));
      box.appendChild(tr);
    });
    $('a-page').textContent = 'Page ' + page + ' of ' + pages;
    $('a-prev').disabled = page <= 1;
    $('a-next').disabled = page >= pages;
  }
  document.querySelectorAll('.a-tab').forEach(function (t) {
    t.addEventListener('click', function () { tab = t.dataset.tab; page = 1; renderList(); });
  });
  $('a-prev').addEventListener('click', function () { page--; renderList(); });
  $('a-next').addEventListener('click', function () { page++; renderList(); });

  function patch(j, fields) {
    fields.updated_at = new Date().toISOString();
    api('/rest/v1/jobs?id=eq.' + j.id, { method: 'PATCH', body: JSON.stringify(fields) }).then(refresh)
      .catch(function (e) { msg('a-jobs-msg', e.message, 'bad'); });
  }
  function edit(j) {
    editing = j;
    closePanels();
    fill(j);
    $('f-when').value = j.publish_at ? localInput(j.publish_at) : '';
    $('f-confirm').hidden = true;
    msg('f-msg', 'Editing "' + j.title + '". Publish Now, Schedule or Save as Draft will update this job.', '');
    $('form-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ----- start -----
  clearForm();
  show();
  window.addEventListener('hashchange', function () { handleHash(takeHash()); show(); });
})();
