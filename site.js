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

  /* Europe map (1.0 look): real country shapes, slow drift, drag to turn. No markers, no feed. */
  (function map() {
    var svg = document.getElementById('mapSvg');
    var land = document.getElementById('mapLand');
    if (!svg || !land || !window.fetch) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W = 760, H = 600, NS = 'http://www.w3.org/2000/svg';
    var phi = 0, theta = 0, dir = 1, dragging = null, last = 0, visible = true;

    function ready(cb, n) {
      if (window.d3 && window.d3.geoConicConformal) return cb();
      if ((n || 0) > 40) return;
      setTimeout(function () { ready(cb, (n || 0) + 1); }, 100);
    }

    ready(function () {
      fetch('/vendor/europe.json').then(function (r) { return r.json(); }).then(function (geo) {
        var d3 = window.d3;
        land.textContent = '';
        var els = geo.features.map(function () { var p = document.createElementNS(NS, 'path'); land.appendChild(p); return p; });
        function render() {
          var proj = d3.geoConicConformal().rotate([-15 + phi, 0]).center([0, 52 + theta])
            .parallels([40, 65]).scale(900).translate([W / 2, H / 2]);
          var path = d3.geoPath(proj);
          for (var i = 0; i < els.length; i++) els[i].setAttribute('d', path(geo.features[i]) || '');
        }
        render();
        svg.classList.add('live');

        svg.addEventListener('pointerdown', function (e) {
          if (e.pointerType === 'touch') return; // let phones scroll the page
          dragging = { x: e.clientX, y: e.clientY };
          svg.setPointerCapture(e.pointerId);
        });
        svg.addEventListener('pointermove', function (e) {
          if (!dragging) return;
          phi += (e.clientX - dragging.x) * 0.18;
          theta = Math.max(-25, Math.min(25, theta - (e.clientY - dragging.y) * 0.1));
          dragging = { x: e.clientX, y: e.clientY };
          render();
        });
        function up() { dragging = null; }
        svg.addEventListener('pointerup', up);
        svg.addEventListener('pointercancel', up);

        if (reduce) return;
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(svg);
        }
        function drift(now) {
          var dt = Math.min(now - (last || now), 100);
          last = now;
          if (!dragging && visible && !document.hidden) {
            phi += dt * 0.0008 * dir;
            if (phi >= 18) { phi = 18; dir = -1; }
            if (phi <= -18) { phi = -18; dir = 1; }
            render();
          }
          requestAnimationFrame(drift);
        }
        requestAnimationFrame(drift);
      }).catch(function () { /* static map stays */ });
    });
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
