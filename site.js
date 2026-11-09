/* Veerpoint v3: scroll curve + Book a call form */
(function () {
  'use strict';

  /* Progression curve: draws as the section scrolls into view; each step lights up when the dot reaches it. */
  (function curve() {
    var section = document.getElementById('how');
    var path = document.getElementById('curvePath');
    var dot = document.getElementById('curveDot');
    if (!section || !path || !dot) return;
    var stones = section.querySelectorAll('.ms');
    var steps = section.querySelectorAll('.step');
    var AT = [0.12, 0.4, 0.68, 0.95];
    var total = path.getTotalLength();

    for (var i = 0; i < stones.length; i++) {
      var pt = path.getPointAtLength(total * AT[i]);
      stones[i].setAttribute('cx', pt.x.toFixed(1));
      stones[i].setAttribute('cy', pt.y.toFixed(1));
    }

    function paint(p) {
      path.style.strokeDasharray = total;
      path.style.strokeDashoffset = total * (1 - p);
      var pt = path.getPointAtLength(total * p);
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      for (var i = 0; i < stones.length; i++) {
        var on = p >= AT[i] - 0.001;
        stones[i].classList.toggle('on', on);
        if (steps[i]) steps[i].classList.toggle('on', on);
      }
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(1); return; }

    var target = 0, current = 0, running = false;
    function read() {
      var r = section.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var start = vh * 0.9, end = vh * 0.1 - r.height * 0.25;
      var s = Math.max(0, Math.min(1, (start - r.top) / (start - end)));
      target = s * 0.95;
    }
    function tick() {
      current += (target - current) * 0.18;
      if (Math.abs(target - current) < 0.0008) { current = target; paint(current); running = false; return; }
      paint(current);
      requestAnimationFrame(tick);
    }
    function kick() { read(); if (!running) { running = true; requestAnimationFrame(tick); } }
    read(); current = target; paint(current);
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
  })();

  /* Book a call form → /api/book */
  (function form() {
    var form = document.getElementById('bookForm');
    if (!form) return;
    var btn = document.getElementById('bookSubmit');
    var err = document.getElementById('bookError');
    var sent = document.getElementById('bookSent');
    var started = Date.now();
    var FAIL = 'Your request didn\'t send. Check your connection and try again, or email <a href="mailto:hello@veerpoint.io">hello@veerpoint.io</a>.';

    function showError(html, field) {
      err.innerHTML = html;
      err.hidden = false;
      if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    }

    form.addEventListener('input', function (e) { e.target.removeAttribute('aria-invalid'); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var f = form.elements;
      var data = {
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        company: f.company.value.trim(),
        phone: f.phone.value.trim(),
        website: f.website.value,
        elapsed: Date.now() - started
      };
      if (!data.name) return showError('Add your name.', f.name);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return showError('Add a valid work email.', f.email);
      if (!data.company) return showError('Add your company.', f.company);

      btn.disabled = true;
      btn.textContent = 'Sending…';
      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
      }).then(function (res) {
        if (!res.ok || !res.j.ok) throw new Error(res.j.error || 'send failed');
        document.getElementById('bookSentEmail').textContent = data.email;
        form.hidden = true;
        sent.hidden = false;
        sent.focus();
      }).catch(function () {
        showError(FAIL);
      }).then(function () {
        btn.disabled = false;
        btn.textContent = 'Book a call';
      });
    });
  })();
})();
