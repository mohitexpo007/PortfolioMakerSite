// static/js/starfield.js
(function () {
  class Starfield {
    constructor(canvas, opts = {}) {
      this.c = canvas;
      this.ctx = this.c.getContext('2d');

      // ---- Tunables (editable) ---------------------------------------------
      this.opts = Object.assign({
        // Star look & motion
        density: 0.00035,          // stars per px^2
        starSize: [3.0, 6.0],      // px (bigger stars)
        twinkle: 0.12,             // 0..1
        drift: 0.0015,              // base drift to the left
        maxSpeed: 0.00028,
        parallax: 0.04,

        // Repulsion near cursor
        repelRadius: 220,          // px
        repelStrength: 1.35,       // push strength
        repelDepthBias: 0.75,      // 0..1 (nearer stars move more)
        throttlePointer: 12,       // ms

        // Space "grazling" gradient look
        useGradientStars: true,    // color each star from palette
        palette: [
          { t: 0.00, rgb: [ 71,  85, 197] }, // indigo-600
          { t: 0.28, rgb: [139,  92, 246] }, // violet-500
          { t: 0.55, rgb: [236,  72, 153] }, // pink-500
          { t: 0.78, rgb: [ 56, 189, 248] }, // sky-400
          { t: 1.00, rgb: [ 99, 102, 241] }, // indigo-500
        ],

        // Nebula background (offscreen, composited under stars)
        nebula: {
          base: '#05070d',         // deep space base
          blobs: 8,                // total number of radial blobs
          radius: [0.25, 0.55],    // relative (of min(w,h)) random radius range
          colors: [
            'rgba(147, 51, 234, 0.13)',  // purple
            'rgba(236, 72, 153, 0.10)',  // pink
            'rgba(59, 130, 246, 0.10)',  // blue
            'rgba(34, 197, 94, 0.07)',   // green
          ]
        }
      }, opts);
      // ----------------------------------------------------------------------

      this.dpr = Math.max(1, window.devicePixelRatio || 1);
      this.stars = [];
      this.mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.rafId = 0;

      // offscreen nebula layer
      this.bg = document.createElement('canvas');
      this.bgCtx = this.bg.getContext('2d');

      // bindings
      this._onResize = this.resize.bind(this);
      this._onLeave = this.onPointerLeave.bind(this);
      let last = 0;
      this._onMove = (e) => {
        const now = performance.now();
        if (now - last < this.opts.throttlePointer) return;
        last = now;
        this.onPointerMove(e);
      };

      this.resize();
      this.spawn();
      this.bind();
      this.tick();

      if (console && console.debug) {
        console.debug('[starfield] stars:', this.targetCount);
      }
    }

    bind() {
      window.addEventListener('resize', this._onResize, { passive: true });
      window.addEventListener('mousemove', this._onMove, { passive: true });
      window.addEventListener('touchmove', this._onMove, { passive: true });
      window.addEventListener('mouseleave', this._onLeave, { passive: true });
    }
    unbind() {
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('mousemove', this._onMove);
      window.removeEventListener('touchmove', this._onMove);
      window.removeEventListener('mouseleave', this._onLeave);
    }

    // ---- sizing & backdrop --------------------------------------------------
    resize() {
      const { c, ctx, dpr, bg, bgCtx, opts } = this;
      const rect = c.getBoundingClientRect();
      let w = Math.max(1, Math.floor(rect.width  || window.innerWidth));
      let h = Math.max(1, Math.floor(rect.height || window.innerHeight));

      // main canvas
      c.width = Math.max(1, Math.floor(w * dpr));
      c.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(dpr, dpr);

      // offscreen bg
      bg.width = c.width;
      bg.height = c.height;
      bgCtx.setTransform(1,0,0,1,0,0);
      bgCtx.scale(dpr, dpr);

      // redraw nebula background once
      this.paintNebula(bgCtx, w, h, opts.nebula);

      // recompute target star count
      const area = w * h;
      this.targetCount = Math.floor(area * this.opts.density);
      if (this.stars.length > this.targetCount) this.stars.length = this.targetCount;
    }

    paintNebula(ctx, w, h, neb) {
      // base fill
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = neb.base;
      ctx.fillRect(0, 0, w, h);

      // subtle directional glow gradient (top-right to bottom-left)
      const lg = ctx.createLinearGradient(w * 0.9, h * 0.05, w * 0.05, h * 0.95);
      lg.addColorStop(0, 'rgba(99,102,241,0.12)');
      lg.addColorStop(1, 'rgba(14,165,233,0.08)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, w, h);

      // nebula blobs with additive blending
      const minDim = Math.min(w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < neb.blobs; i++) {
        const cx = Math.random() * w;
        const cy = Math.random() * h;
        const rRel = this.lerp(neb.radius[0], neb.radius[1], Math.random());
        const r = rRel * minDim;
        const color = neb.colors[i % neb.colors.length];

        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0.0, color);
        rg.addColorStop(1.0, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // ------------------------------------------------------------------------

    spawn() { while (this.stars.length < this.targetCount) this.stars.push(this.makeStar()); }

    makeStar() {
      const z = Math.random();
      const size = this.lerp(this.opts.starSize[0], this.opts.starSize[1], z);
      return {
        x: Math.random(), y: Math.random(), z,
        s: size,
        a: 0.75 + Math.random() * 0.25,
        tw: Math.random() * Math.PI * 2
      };
    }

    onPointerMove(e) {
      const rect = this.c.getBoundingClientRect();
      let cx, cy;
      if (e.touches && e.touches[0]) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      else { cx = e.clientX; cy = e.clientY; }
      const w = rect.width  || window.innerWidth || 1;
      const h = rect.height || window.innerHeight || 1;
      this.mouse.targetX = (cx - rect.left) / w;
      this.mouse.targetY = (cy - rect.top) / h;
    }
    onPointerLeave() { this.mouse.targetX = 0.5; this.mouse.targetY = 0.5; }

    lerp(a, b, t) { return a + (b - a) * t; }
    clamp01(x){ return Math.max(0, Math.min(1, x)); }

    // palette sampling (t in 0..1)
    samplePalette(t) {
      const p = this.opts.palette;
      if (!p || p.length === 0) return [235, 240, 255];
      t = this.clamp01(t);
      // find segment
      let i = 0;
      while (i < p.length - 1 && t > p[i+1].t) i++;
      const a = p[i], b = p[Math.min(i+1, p.length - 1)];
      const span = (b.t - a.t) || 1;
      const k = (t - a.t) / span;
      return [
        Math.round(this.lerp(a.rgb[0], b.rgb[0], k)),
        Math.round(this.lerp(a.rgb[1], b.rgb[1], k)),
        Math.round(this.lerp(a.rgb[2], b.rgb[2], k)),
      ];
    }

    // ---- main loop ----------------------------------------------------------
    tick = () => {
      this.rafId = requestAnimationFrame(this.tick);
      if (this.reduced) { this.draw(true); return; }

      // smooth follow
      this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.20;
      this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.20;

      this.update();
      this.draw();
    }

    update() {
      const { stars, opts } = this;
      const w = this.c.clientWidth  || window.innerWidth;
      const h = this.c.clientHeight || window.innerHeight;

      const parx = (this.mouse.x - 0.5) * opts.parallax;
      const pary = (this.mouse.y - 0.5) * opts.parallax;

      for (let s of stars) {
        // base drift + subtle parallax
        s.x += -opts.drift * (0.5 + 0.5 * s.z);
        s.x -= parx * (0.3 + 0.7 * s.z);
        s.y -= pary * (0.3 + 0.7 * s.z);

        // repulsion
        const sx = s.x * w, sy = s.y * h;
        const mx = this.mouse.x * w, my = this.mouse.y * h;
        const dx = sx - mx, dy = sy - my;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < opts.repelRadius) {
          const t = 1 - (dist / opts.repelRadius);
          const fall = t * t;
          const depthScale = this.lerp(1, 1 - opts.repelDepthBias, s.z);
          const push = opts.repelStrength * fall * depthScale;
          s.x += (dx / dist) * push / w * 14;
          s.y += (dy / dist) * push / h * 14;
        }

        // wrap
        if (s.x < -0.05) s.x = 1.05;
        if (s.x > 1.05) s.x = -0.05;
        if (s.y < -0.05) s.y = 1.05;
        if (s.y > 1.05) s.y = -0.05;

        s.tw += 0.02 + this.lerp(opts.maxSpeed * 0.15, opts.maxSpeed, s.z) * 0.01;
      }

      if (stars.length < this.targetCount) this.spawn();
    }

    draw(staticFrame = false) {
      const { ctx, bg } = this;
      const w = this.c.clientWidth  || window.innerWidth;
      const h = this.c.clientHeight || window.innerHeight;

      // draw pre-rendered nebula
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bg, 0, 0, w, h);

      // draw stars (colored from palette for a "grazling" look)
      for (let s of this.stars) {
        const x = s.x * w, y = s.y * h;
        const tpos = this.clamp01((s.x * 0.7 + s.y * 0.3)); // sample palette by position
        const [r, g, b] = this.opts.useGradientStars ? this.samplePalette(tpos) : [235, 240, 255];
        const tw = staticFrame ? 1 : (0.88 + Math.sin(s.tw) * this.opts.twinkle);
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, s.a * tw)})`;
        ctx.fillRect(x, y, s.s, s.s);
      }
    }
    // ------------------------------------------------------------------------

    destroy() { cancelAnimationFrame(this.rafId); this.unbind(); this.stars = []; }
  }

  function initStarfields() {
    document.querySelectorAll('[data-starfield]').forEach(el => {
      if (el.__starfield) return;
      el.__starfield = new Starfield(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStarfields);
  } else {
    initStarfields();
  }

  window.Starfield = Starfield;
})();
