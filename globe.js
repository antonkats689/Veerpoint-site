/* Veerpoint globe: Europe-centred, turns slowly; points veer in and land on major markets. */
(function () {
  'use strict';
  var svg = document.getElementById('globe');
  if (!svg || !window.fetch) return;
  var NS = 'http://www.w3.org/2000/svg';
  var SIZE = 640, R = 290, C = SIZE / 2;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // [lon, lat]; major European markets.
  var CITIES = [
    [-0.13, 51.51], [2.35, 48.86], [13.40, 52.52], [-3.70, 40.42], [4.90, 52.37],
    [9.19, 45.46], [18.07, 59.33], [21.01, 52.23], [-6.26, 53.35], [-9.14, 38.72],
    [8.54, 47.37], [12.57, 55.68], [11.58, 48.14], [2.17, 41.39], [4.35, 50.85],
    [16.37, 48.21], [14.42, 50.08], [10.75, 59.91], [24.94, 60.17], [12.50, 41.90]
  ];

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function ready(cb, n) {
    if (window.d3 && window.d3.geoOrthographic) return cb();
    if ((n || 0) > 40) return;
    setTimeout(function () { ready(cb, (n || 0) + 1); }, 100);
  }

  ready(function () {
    Promise.all([
      fetch('/vendor/land.json').then(function (r) { return r.json(); }),
      fetch('/vendor/europe.json').then(function (r) { return r.json(); })
    ]).then(function (data) {
      var d3 = window.d3, land = data[0], europe = data[1];
      var g = svg.querySelector('.g-live');
      svg.querySelector('.g-static') && svg.querySelector('.g-static').remove();

      var grat = el('path', { class: 'g-grat' }, g);
      var landP = el('path', { class: 'g-land' }, g);
      var euP = el('path', { class: 'g-eu' }, g);
      var dropsG = el('g', { class: 'g-drops' }, svg);

      var rot = [-9, -50, 0];         // centre: lon 9E, lat 50N
      var base = -9, phase = 0, dragging = null, visible = true, last = 0;
      var proj = d3.geoOrthographic().scale(460).translate([C, C]).clipAngle(39.1).precision(0.6);
      var path = d3.geoPath(proj);
      var graticule = d3.geoGraticule10();

      function render() {
        proj.rotate(rot);
        grat.setAttribute('d', path(graticule));
        landP.setAttribute('d', path(land));
        euP.setAttribute('d', path(europe));
      }

      /* drops */
      var drops = [], landed = [], MAX_LANDED = 7;
      function isVisible(ll) { return d3.geoDistance(ll, [-rot[0], -rot[1]]) < 0.6; }
      function pickCity() {
        for (var t = 0; t < 20; t++) {
          var c = CITIES[Math.floor(Math.random() * CITIES.length)];
          if (isVisible(c) && landed.every(function (l) { return l.ll !== c; })) return c;
        }
        return null;
      }
      function spawn(now) {
        var ll = pickCity();
        if (!ll) return;
        var trail = el('path', { class: 'd-trail' }, dropsG);
        var head = el('circle', { class: 'd-head', r: 4 }, dropsG);
        var side = Math.random() < 0.5 ? -1 : 1;
        drops.push({ ll: ll, t0: now, trail: trail, head: head, dx: side * (90 + Math.random() * 70), dy: -(140 + Math.random() * 60) });
      }
      function land_(d, now) {
        d.trail.remove(); d.head.remove();
        var ring = el('circle', { class: 'd-ring', r: 4 }, dropsG);
        var dot = el('circle', { class: 'd-dot', r: 4.5 }, dropsG);
        landed.push({ ll: d.ll, t0: now, ring: ring, dot: dot });
        if (landed.length > MAX_LANDED) {
          var old = landed.shift();
          old.dot.classList.add('out');
          setTimeout(function () { old.dot.remove(); old.ring.remove(); }, 600);
        }
      }
      var FLY = 900;
      function frameDrops(now) {
        for (var i = drops.length - 1; i >= 0; i--) {
          var d = drops[i], k = Math.min(1, (now - d.t0) / FLY);
          var end = proj(d.ll);
          if (!isVisible(d.ll) || !end) { d.trail.remove(); d.head.remove(); drops.splice(i, 1); continue; }
          var sx = end[0] + d.dx, sy = end[1] + d.dy;
          var cx = end[0] + d.dx * 0.05, cy = end[1] + d.dy * 0.9; // veer: comes in wide, turns onto the point
          var e = 1 - Math.pow(1 - k, 3);
          var t0 = Math.max(0, e - 0.28);
          function q(t) { var a = 1 - t; return [a * a * sx + 2 * a * t * cx + t * t * end[0], a * a * sy + 2 * a * t * cy + t * t * end[1]]; }
          var pts = [];
          for (var s = 0; s <= 8; s++) pts.push(q(t0 + (e - t0) * s / 8));
          d.trail.setAttribute('d', 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L'));
          d.head.setAttribute('cx', pts[8][0]); d.head.setAttribute('cy', pts[8][1]);
          if (k >= 1) { land_(d, now); drops.splice(i, 1); }
        }
        for (var j = 0; j < landed.length; j++) {
          var l = landed[j], p = proj(l.ll), vis = isVisible(l.ll);
          l.dot.style.display = l.ring.style.display = vis ? '' : 'none';
          if (!vis || !p) continue;
          l.dot.setAttribute('cx', p[0]); l.dot.setAttribute('cy', p[1]);
          var rk = (now - l.t0) / 1400;
          if (rk < 1) {
            l.ring.setAttribute('cx', p[0]); l.ring.setAttribute('cy', p[1]);
            l.ring.setAttribute('r', 5 + rk * 30);
            l.ring.style.opacity = (1 - rk).toFixed(2);
          } else l.ring.style.opacity = 0;
        }
      }

      render();
      svg.classList.add('live');

      /* drag (mouse/pen only so phones keep scrolling) */
      svg.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch') return;
        dragging = { x: e.clientX, y: e.clientY };
        svg.setPointerCapture(e.pointerId);
      });
      svg.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        rot[0] += (e.clientX - dragging.x) * 0.3;
        rot[1] = Math.max(-70, Math.min(-25, rot[1] - (e.clientY - dragging.y) * 0.3));
        dragging = { x: e.clientX, y: e.clientY };
        base = rot[0]; phase = 0;
        render();
      });
      function up() { dragging = null; }
      svg.addEventListener('pointerup', up);
      svg.addEventListener('pointercancel', up);

      if (reduce) {
        // Still image: a few points already landed.
        var t = performance.now();
        for (var n = 0; n < 5; n++) { var c = pickCity(); if (c) land_({ ll: c, trail: el('g', {}), head: el('g', {}) }, t - 5000); }
        frameDrops(t);
        return;
      }

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(svg);
      }
      var nextDrop = 0;
      function tick(now) {
        var dt = Math.min(now - (last || now), 100);
        last = now;
        if (visible && !document.hidden) {
          if (!dragging) {
            // Sway between the US East Coast and eastern Europe, Europe always in view.
            phase += dt * 0.00012;
            var ease = Math.min(1, dt * 0.0006);
            base += (-9 - base) * ease;
            rot[1] += (-50 - rot[1]) * ease;
            rot[0] = base + Math.sin(phase) * 10;
            render();
          }
          if (now > nextDrop) { spawn(now); nextDrop = now + 1500 + Math.random() * 900; }
          frameDrops(now);
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }).catch(function () { /* static globe stays */ });
  });
})();
