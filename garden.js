/* Motor del jardín: dibuja y anima todo en un <canvas>. Expone window.Garden. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  /* ---------- Paleta día / noche ---------- */
  const PAL_HEX = {
    skyTop:    ['#a9d8f0', '#0a1030'],
    skyMid:    ['#fde8b8', '#1c2050'],
    skyBot:    ['#ffd3a1', '#4a2f62'],
    hillFar:   ['#c3d68a', '#1d3a52'],
    hillMid:   ['#a6c260', '#17394a'],
    groundTop: ['#8fb64b', '#1a4638'],
    groundBot: ['#5c8c33', '#0c2a20'],
    stem:      ['#4d8a2a', '#2f7050'],
    leaf:      ['#5da236', '#367f58'],
    grassA:    ['#79ab3c', '#25634b'],
    grassB:    ['#9cc751', '#2f7a5b']
  };
  const toRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const PAL = Object.fromEntries(Object.entries(PAL_HEX).map(([k, [a, b]]) => [k, [toRGB(a), toRGB(b)]]));
  function palette(n) {
    const out = {};
    for (const k in PAL) {
      const [a, b] = PAL[k];
      out[k] = `rgb(${Math.round(lerp(a[0], b[0], n))},${Math.round(lerp(a[1], b[1], n))},${Math.round(lerp(a[2], b[2], n))})`;
    }
    return out;
  }

  /* ---------- Estado ---------- */
  let canvas, ctx, W = 0, H = 0, DPR = 1, gTop = 0, unit = 1, last = 0, nextId = 1;
  const S = {
    flowers: [], petals: [], hearts: [], motes: [], clouds: [], stars: [], grassA: [], grassB: [], fore: [],
    night: 0, nightTarget: 0, time: 0, rain: 0, spawnT: 0, hover: null,
    ptr: { x: -999, y: -999 }, cb: {},
    reduced: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  const baseY = d => gTop + H * 0.035 + d * (H - gTop - H * 0.07);
  const depthFromY = y => clamp((y - (gTop + H * 0.035)) / (H - gTop - H * 0.07), 0, 1);
  const scaleOf = d => 0.5 + d * 0.8;
  const heightOf = f => f.hFrac * H * 0.36 * scaleOf(f.d);

  /* ---------- Creación de elementos ---------- */
  function pickType() {
    const r = Math.random();
    return r < 0.5 ? 'girasol' : r < 0.8 ? 'margarita' : 'narciso';
  }

  function makeFlower(o) {
    return {
      id: nextId++, nx: o.nx, d: o.d, type: o.type || pickType(), size: o.size ?? Math.random(),
      hFrac: rand(0.7, 1.1), phase: rand(0, TAU), rot: rand(0, TAU), tilt: rand(-0.18, 0.18),
      hue: rand(42, 51), age: -(o.delay || 0), growth: 0, push: 0, wobble: 0, hover: 0,
      memory: o.memory ?? null, user: !!o.user, hx: 0, hy: 0, hr: 0
    };
  }

  function build(memCount) {
    S.flowers = [];
    const n = Math.max(clamp(Math.round(W / 38), 14, 44), memCount + 8);
    const items = [];
    for (let i = 0; i < n; i++) items.push({ nx: (i + rand(0.1, 0.9)) / n, d: rand(0, 1) });
    for (let k = 0; k < memCount; k++) {
      const it = items[Math.floor((k + 0.5) * n / memCount)];
      it.memory = k; it.d = rand(0.5, 0.9); it.type = 'girasol'; it.size = rand(0.75, 1);
    }
    const order = items.map((_, i) => i).sort(() => Math.random() - 0.5);
    items.forEach((it, i) => { it.delay = 0.3 + order[i] * 0.11; S.flowers.push(makeFlower(it)); });
    S.flowers.sort((a, b) => a.d - b.d);
  }

  function buildScenery() {
    S.clouds = Array.from({ length: 5 }, () => ({ x: rand(0, W), y: rand(0.06, 0.42) * gTop, s: rand(0.7, 1.5) * unit, sp: rand(4, 12) }));
    S.stars = Array.from({ length: 90 }, () => ({ nx: Math.random(), ny: Math.random() * 0.85, r: rand(0.5, 1.6), ph: rand(0, TAU) }));
    const blade = (extra = {}) => ({ nx: Math.random(), d: Math.random(), o: rand(-4, 8), h: rand(10, 26), ph: rand(0, TAU), ...extra });
    S.grassA = Array.from({ length: 170 }, () => blade());
    S.grassB = Array.from({ length: 170 }, () => blade());
    S.fore = Array.from({ length: 60 }, () => blade({ d: 1, o: rand(0, 26), h: rand(34, 70) }));
    S.motes = Array.from({ length: S.reduced ? 14 : 42 }, () => ({
      x: rand(0, W), y: rand(gTop * 0.55, H), vx: rand(-6, 6), vy: rand(-6, 2), ph: rand(0, TAU), r: rand(1.2, 2.6)
    }));
  }

  function spawnPetal(x, y, burst) {
    S.petals.push({
      x, y, vx: burst ? rand(-90, 90) : rand(-15, 15), vy: burst ? rand(-120, -20) : rand(10, 40),
      rot: rand(0, TAU), vr: rand(-3, 3), s: rand(4, 8) * unit, ph: rand(0, TAU), hue: rand(42, 52)
    });
  }
  function spawnHearts(x, y, n) {
    for (let i = 0; i < n; i++) S.hearts.push({ x: x + rand(-14, 14), y, vx: rand(-14, 14), vy: rand(-90, -50), life: 1, s: rand(5, 9) * unit });
  }

  /* ---------- Actualización ---------- */
  function update(dt) {
    S.time += dt;
    S.night += (S.nightTarget - S.night) * Math.min(1, dt * 1.6);
    const wind = Math.sin(S.time * 0.3) * 20 + 30;

    for (const f of S.flowers) {
      f.age += dt;
      f.growth = clamp(f.age / 2.4, 0, 1);
      f.wobble = Math.max(0, f.wobble - dt * 0.9);
      f.hover += ((S.hover === f ? 1 : 0) - f.hover) * Math.min(1, dt * 10);
    }

    // pétalos que caen
    S.spawnT -= dt;
    if (!S.reduced && S.spawnT <= 0) { spawnPetal(rand(0, W), -10, false); S.spawnT = rand(0.5, 1.1); }
    if (S.rain > 0) {
      S.rain -= dt;
      const count = Math.floor(dt * 45 + Math.random());
      for (let i = 0; i < count; i++) spawnPetal(rand(-20, W + 20), -12, false);
    }
    for (let i = S.petals.length - 1; i >= 0; i--) {
      const p = S.petals[i];
      p.vy += (45 - p.vy) * Math.min(1, dt * 1.5);
      p.vx += (wind - p.vx) * Math.min(1, dt * 0.6);
      p.x += p.vx * dt + Math.sin(S.time * 2 + p.ph) * 22 * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > H + 20 || p.x > W + 60 || p.x < -60) S.petals.splice(i, 1);
    }
    for (let i = S.hearts.length - 1; i >= 0; i--) {
      const h = S.hearts[i];
      h.x += h.vx * dt + Math.sin(S.time * 3 + i) * 12 * dt; h.y += h.vy * dt; h.vy *= 1 - dt * 0.6; h.life -= dt * 0.5;
      if (h.life <= 0) S.hearts.splice(i, 1);
    }
    for (const m of S.motes) {
      m.x += (m.vx + wind * 0.15) * dt; m.y += m.vy * dt + Math.sin(S.time * 0.8 + m.ph) * 8 * dt;
      if (m.x > W + 10) m.x = -10; else if (m.x < -10) m.x = W + 10;
      if (m.y < gTop * 0.5) m.y = H; else if (m.y > H + 10) m.y = gTop * 0.6;
    }
    for (const c of S.clouds) { c.x += c.sp * dt; if (c.x - 90 * c.s > W) c.x = -120 * c.s; }
  }

  /* ---------- Dibujo ---------- */
  function ell(x, y, rx, ry) { ctx.moveTo(x + rx, y); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); }

  function drawSky(p) {
    const g = ctx.createLinearGradient(0, 0, 0, gTop);
    g.addColorStop(0, p.skyTop); g.addColorStop(0.55, p.skyMid); g.addColorStop(1, p.skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const n = S.night, t = S.time;
    if (n > 0.02) {
      for (const s of S.stars) {
        const a = n * (0.45 + 0.55 * Math.sin(t * 1.5 + s.ph));
        ctx.fillStyle = `rgba(255,250,220,${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(s.nx * W, s.ny * gTop, s.r, 0, TAU); ctx.fill();
      }
    }

    const cx = W * 0.78, cy = gTop * 0.42, R = clamp(Math.min(W, H) * 0.065, 28, 70);
    const day = 1 - n;
    if (day > 0.01) {
      const g2 = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 5);
      g2.addColorStop(0, `rgba(255,240,170,${0.85 * day})`); g2.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx, cy, R * 5, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,245,196,${day})`; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    }
    if (n > 0.01) {
      const g3 = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 4);
      g3.addColorStop(0, `rgba(200,215,255,${0.4 * n})`); g3.addColorStop(1, 'rgba(200,215,255,0)');
      ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(cx, cy, R * 4, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(246,241,220,${n})`; ctx.beginPath(); ctx.arc(cx, cy, R * 0.85, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(200,192,165,${0.45 * n})`;
      ctx.beginPath(); ctx.arc(cx - R * 0.25, cy - R * 0.2, R * 0.2, 0, TAU); ctx.arc(cx + R * 0.3, cy + R * 0.25, R * 0.14, 0, TAU); ctx.arc(cx + R * 0.15, cy - R * 0.4, R * 0.1, 0, TAU); ctx.fill();
    }

    ctx.fillStyle = n < 0.5 ? `rgba(255,255,255,${0.75 * (1 - n * 1.6)})` : `rgba(170,180,255,${0.08 + 0.1 * (1 - n)})`;
    for (const c of S.clouds) {
      const s = c.s;
      ctx.beginPath();
      ell(c.x, c.y, 60 * s, 20 * s); ell(c.x - 30 * s, c.y - 10 * s, 30 * s, 22 * s);
      ell(c.x + 5 * s, c.y - 22 * s, 34 * s, 26 * s); ell(c.x + 38 * s, c.y - 8 * s, 28 * s, 20 * s);
      ctx.fill();
    }
  }

  function hill(base, amp, f1, p1, fill) {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 12; x += 12) {
      ctx.lineTo(x, base + Math.sin(x * f1 + p1) * amp + Math.sin(x * f1 * 2.3 + p1 * 1.7) * amp * 0.45);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }

  function drawGrass(list, color, lw) {
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath();
    const t = S.time;
    for (const b of list) {
      const x = b.nx * W, y = baseY(b.d) + b.o, h = b.h * (0.5 + b.d * 0.9) * unit;
      const sw = Math.sin(t * 1.3 + b.ph + x * 0.01) * h * 0.25;
      ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sw * 0.3, y - h * 0.6, x + sw, y - h);
    }
    ctx.stroke();
  }

  function petalLayer(count, r0, r1, w, off, fill) {
    ctx.save(); ctx.rotate(off); ctx.beginPath();
    const step = TAU / count, mid = (r0 + r1) / 2;
    for (let i = 0; i < count; i++) {
      ctx.moveTo(r0, 0); ctx.quadraticCurveTo(mid, -w, r1, 0); ctx.quadraticCurveTo(mid, w, r0, 0); ctx.rotate(step);
    }
    ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }
  function roundPetalLayer(count, r0, r1, w, off, fill) {
    ctx.save(); ctx.rotate(off); ctx.beginPath();
    const step = TAU / count, mid = (r0 + r1) / 2;
    for (let i = 0; i < count; i++) {
      ctx.moveTo(r0, 0); ctx.bezierCurveTo(mid * 0.9, -w, r1, -w * 0.8, r1, 0); ctx.bezierCurveTo(r1, w * 0.8, mid * 0.9, w, r0, 0); ctx.rotate(step);
    }
    ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }

  function drawHead(f, R, p) {
    const n = S.night, t = S.time;
    const L = base => `hsl(${f.hue},100%,${(base - n * 10).toFixed(1)}%)`;

    if (f.memory !== null) {
      const a = (0.5 + 0.2 * Math.sin(t * 2.2 + f.phase)) * (1 + n * 0.6);
      const g = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 2.8);
      g.addColorStop(0, `rgba(255,246,170,${a.toFixed(3)})`); g.addColorStop(0.45, `rgba(255,224,90,${(a * 0.45).toFixed(3)})`); g.addColorStop(1, 'rgba(255,224,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 2.8, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = p.leaf; ctx.beginPath(); ctx.arc(0, 0, R * 0.6, 0, TAU); ctx.fill();
    ctx.rotate(f.rot);

    if (f.type === 'girasol') {
      petalLayer(18, R * 0.35, R * 1.08, R * 0.34, 0, L(46));
      petalLayer(18, R * 0.3, R * 0.9, R * 0.3, TAU / 36, L(56));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.44);
      g.addColorStop(0, '#4a2b0b'); g.addColorStop(0.7, '#6b3f12'); g.addColorStop(1, '#8a5a1e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.44, 0, TAU); ctx.fill();
      if (R > 14) {
        ctx.fillStyle = 'rgba(255,214,120,0.32)'; ctx.beginPath();
        for (let k = 1; k <= 40; k++) {
          const r = Math.sqrt(k / 40) * R * 0.4, a = k * 2.39996, x = Math.cos(a) * r, y = Math.sin(a) * r;
          ctx.moveTo(x + R * 0.028, y); ctx.arc(x, y, R * 0.028, 0, TAU);
        }
        ctx.fill();
      }
    } else if (f.type === 'margarita') {
      petalLayer(13, R * 0.22, R * 1.05, R * 0.2, 0, L(60));
      petalLayer(13, R * 0.22, R * 0.9, R * 0.16, TAU / 26, L(68));
      const g = ctx.createRadialGradient(-R * 0.05, -R * 0.05, 0, 0, 0, R * 0.26);
      g.addColorStop(0, '#ffc93a'); g.addColorStop(1, '#ee8a00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.26, 0, TAU); ctx.fill();
    } else {
      roundPetalLayer(6, R * 0.2, R * 1.05, R * 0.5, 0, L(62));
      roundPetalLayer(6, R * 0.2, R * 0.85, R * 0.42, TAU / 12, L(70));
      ctx.fillStyle = '#f7a21a'; ctx.beginPath(); ctx.arc(0, 0, R * 0.36, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffc447'; ctx.lineWidth = R * 0.06; ctx.stroke();
      ctx.fillStyle = '#d97706'; ctx.beginPath(); ctx.arc(0, 0, R * 0.22, 0, TAU); ctx.fill();
    }
  }

  function drawFlower(f, p) {
    if (f.growth <= 0) return;
    const t = S.time, scale = scaleOf(f.d);
    const x = f.nx * W, by = baseY(f.d);
    const gs = easeOutCubic(f.growth);
    const h = heightOf(f) * gs;
    const R = (20 + f.size * 12) * scale * unit;

    // viento + empuje del puntero + rebote al tocar
    const wind = Math.sin(t * 0.8 + f.phase + x * 0.004) * 0.5 + Math.sin(t * 1.9 + f.phase * 1.7) * 0.15;
    const dx = x - S.ptr.x, dy = (by - h * 0.6) - S.ptr.y, dist = Math.hypot(dx, dy);
    const target = dist < 150 ? (dx / (dist || 1)) * (1 - dist / 150) * h * 0.2 : 0;
    f.push += (target - f.push) * 0.08;
    const sway = wind * h * 0.09 + f.push + f.wobble * Math.sin(t * 16) * h * 0.08;

    const hx = x + sway, hy = by - Math.sqrt(Math.max(1, h * h - sway * sway));
    const cx = x + sway * 0.2, cy = by - h * 0.55;

    ctx.strokeStyle = p.stem; ctx.lineWidth = Math.max(2, 3.2 * scale * unit); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(cx, cy, hx, hy); ctx.stroke();

    // hojas
    ctx.fillStyle = p.leaf;
    [[0.3, 1], [0.55, -1]].forEach(([tt, side]) => {
      const u = 1 - tt;
      const lx = u * u * x + 2 * u * tt * cx + tt * tt * hx, ly = u * u * by + 2 * u * tt * cy + tt * tt * hy;
      const len = (26 + f.size * 10) * scale * unit * gs;
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(side > 0 ? -0.6 : Math.PI + 0.6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.28, len, 0); ctx.quadraticCurveTo(len * 0.5, len * 0.28, 0, 0); ctx.fill();
      ctx.restore();
    });

    // cabeza
    const bloom = easeOutBack(clamp((f.growth - 0.5) / 0.5, 0, 1));
    const hs = bloom * (1 + f.hover * 0.1);
    f.hx = hx; f.hy = hy; f.hr = R * hs;
    if (hs <= 0.01) return;
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(Math.atan2(hy - cy, hx - cx) + Math.PI / 2 + f.tilt); ctx.scale(hs, hs);
    drawHead(f, R, p);
    ctx.restore();
  }

  function drawParticles() {
    const n = S.night, t = S.time;
    for (const p of S.petals) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = `hsl(${p.hue},100%,${(56 - n * 10).toFixed(0)}%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.5, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    for (const h of S.hearts) {
      ctx.save(); ctx.translate(h.x, h.y); ctx.globalAlpha = clamp(h.life, 0, 1); ctx.fillStyle = '#ff7b93';
      const s = h.s; ctx.beginPath(); ctx.moveTo(0, s * 0.35);
      ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s, 0, -s * 0.45); ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.3, 0, s * 0.35);
      ctx.fill(); ctx.restore();
    }
    for (const m of S.motes) {
      if (n > 0.05) {
        const a = n * (0.5 + 0.5 * Math.sin(t * 1.5 + m.ph));
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 7);
        g.addColorStop(0, `rgba(240,255,130,${a.toFixed(3)})`); g.addColorStop(1, 'rgba(240,255,130,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 7, 0, TAU); ctx.fill();
      }
      if (n < 0.95) {
        ctx.fillStyle = `rgba(255,248,200,${(0.5 * (1 - n)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.7, 0, TAU); ctx.fill();
      }
    }
  }

  function draw() {
    const p = palette(S.night);
    drawSky(p);
    hill(gTop - H * 0.045, H * 0.03, 0.004, 1.2, p.hillFar);
    hill(gTop - H * 0.02, H * 0.02, 0.006, 4.1, p.hillMid);
    const g = ctx.createLinearGradient(0, gTop, 0, H);
    g.addColorStop(0, p.groundTop); g.addColorStop(1, p.groundBot);
    hill(gTop, H * 0.008, 0.009, 2.3, g);

    drawGrass(S.grassA, p.grassA, 2);
    drawGrass(S.grassB, p.grassB, 2);
    for (const f of S.flowers) drawFlower(f, p);
    drawGrass(S.fore, p.grassB, 3);
    drawParticles();
  }

  /* ---------- Interacción ---------- */
  function hit(x, y) {
    for (let i = S.flowers.length - 1; i >= 0; i--) {
      const f = S.flowers[i];
      if (f.growth > 0.7 && Math.hypot(f.hx - x, f.hy - y) <= Math.max(f.hr * 1.15, 14)) return f;
    }
    return null;
  }

  function burst(f) {
    for (let i = 0; i < 12; i++) spawnPetal(f.hx, f.hy, true);
    f.wobble = 1;
  }

  function plant(x, y) {
    if (x == null) { x = rand(W * 0.08, W * 0.92); y = rand(gTop + H * 0.05, H * 0.92); }
    const f = makeFlower({ nx: x / W, d: depthFromY(y), user: true });
    S.flowers.push(f); S.flowers.sort((a, b) => a.d - b.d);
    if (S.flowers.length > 170) {
      let oldest = null;
      for (const o of S.flowers) if (o.user && o !== f && (!oldest || o.id < oldest.id)) oldest = o;
      if (oldest) S.flowers.splice(S.flowers.indexOf(oldest), 1);
    }
    spawnHearts(x, y - heightOf(f) * 0.6, 5);
    for (let i = 0; i < 6; i++) spawnPetal(x, y - 6, true);
    if (S.cb.onPlant) S.cb.onPlant(x, y - heightOf(f) - (20 + f.size * 12) * scaleOf(f.d) * unit * 1.5);
  }

  function onMove(e) {
    S.ptr.x = e.clientX; S.ptr.y = e.clientY;
    const f = hit(e.clientX, e.clientY);
    S.hover = f;
    canvas.style.cursor = f ? 'pointer' : (e.clientY > gTop ? 'copy' : 'default');
  }
  function onLeave() { S.ptr.x = -999; S.ptr.y = -999; S.hover = null; }
  function onClick(e) {
    const f = hit(e.clientX, e.clientY);
    if (f) {
      if (f.memory !== null && S.cb.onMemory) S.cb.onMemory(f.memory);
      else burst(f);
      return;
    }
    if (e.clientY > gTop) plant(e.clientX, e.clientY);
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    gTop = H * 0.6;
    unit = clamp(Math.min(W, H * 1.3) / 820, 0.62, 1.15);
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt); draw();
  }

  /* ---------- API pública ---------- */
  window.Garden = {
    init(cv, callbacks) {
      canvas = cv; ctx = cv.getContext('2d'); S.cb = callbacks || {};
      resize(); buildScenery();
      window.addEventListener('resize', () => { resize(); });
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerdown', onMove);
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') onLeave(); });
      canvas.addEventListener('click', onClick);
      build(0);
      requestAnimationFrame(frame);
    },
    setMemories(count) { build(count); },
    setNight(on) { S.nightTarget = on ? 1 : 0; },
    rain() { S.rain = 3; },
    plant
  };
})();
